import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import dataset from "../tests/fixtures/ai/questions.json";

const configSchema = z.object({
  baseUrl: z.url().refine((url) => ["http:", "https:"].includes(new URL(url).protocol)),
  courseId: z.string().min(1),
  materials: z.record(z.string(), z.string().min(1)),
  responseMode: z.enum(["chat", "avatar"]).default("chat"),
});

type EvaluationCase = {
  id: string; question: string; expected_answer: string;
  expected_sources: Array<{ file: string; page: number }>;
  history: Array<{ role: string; content: string }>;
  selected_files?: string[];
  forbidden_answer_fragments?: string[];
};

function option(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

async function main() {
  if (!process.argv.includes("--live")) {
    console.log(JSON.stringify({ kind: "dry-run", cases: dataset.cases.length, note: "No API calls or writes. Use --live --config <path> --out <report.json>; set AI_EVAL_COOKIE locally." }, null, 2));
    return;
  }
  const config = configSchema.parse(JSON.parse(await readFile(option("--config", "docs/ai/evaluation-config.example.json"), "utf8")));
  const cookie = process.env.AI_EVAL_COOKIE;
  if (!cookie) throw new Error("AI_EVAL_COOKIE must contain a development student's session cookie. Never commit it.");
  const limit = Number(option("--limit", "25"));
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error("--limit must be 1..25");
  const output = option("--out", "output/ai-evaluation/live.json");
  const base = new URL(`/api/courses/${encodeURIComponent(config.courseId)}/tutor`, config.baseUrl).href;
  const headers = { Cookie: cookie, "Content-Type": "application/json", Origin: new URL(config.baseUrl).origin };
  const results: Array<Record<string, unknown>> = [];
  const fixtureHash = createHash("sha256").update(await readFile("tests/fixtures/ai/questions.json")).digest("hex");
  const report = {
    kind: "live", revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    fixtureHash, academicLevel: null as string | null, startedAt: new Date().toISOString(), config, results,
    note: "Actual application responses. Human scores are required; source presence alone does not prove correctness. Sessions are retained for inspection.",
  };
  async function save() {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  }
  async function request(path: string, method = "GET", body?: unknown) {
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180_000), redirect: "error" });
    if (!response.ok) throw new Error(`Application returned HTTP ${response.status}`);
    return response;
  }
  async function ask(sessionId: string, content: string) {
    const body = await (await request(`/sessions/${encodeURIComponent(sessionId)}/messages`, "POST", { content, responseMode: config.responseMode })).text();
    const events = body.split(/\r?\n\r?\n/).filter(Boolean).map((block) => {
      const lines = block.split(/\r?\n/);
      return { event: lines.find((line) => line.startsWith("event: "))?.slice(7), data: JSON.parse(lines.filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n")) };
    });
    if (events.some((event) => event.event === "error") || !events.some((event) => event.event === "done")) {
      throw new Error("Application stream failed or did not complete; inspect the test session.");
    }
    return {
      answer: events.filter((event) => event.event === "text").map((event) => event.data.text).join(""),
      metadata: events.find((event) => event.event === "metadata")?.data,
    };
  }
  // Validate fixture availability before creating any sessions. PDF 03 belongs only to the other course.
  const overview = await (await request("")).json();
  report.academicLevel = overview.user?.academicLevel ?? null;
  for (const file of dataset.default_selected_files) {
    const id = config.materials[file];
    if (!id || !overview.readyMaterials.some((material: { id: string; fileName: string }) => material.id === id && material.fileName === file)) {
      throw new Error(`Missing ready fixture mapping: ${file}`);
    }
  }
  for (const item of dataset.cases.slice(0, limit) as EvaluationCase[]) {
    const result: Record<string, unknown> = { id: item.id, question: item.question, expectedAnswer: item.expected_answer, expectedSources: item.expected_sources, scores: null };
    const started = performance.now();
    try {
      const session = await (await request("/sessions", "POST")).json();
      result.sessionId = session.id;
      const selectedMaterialIds = (item.selected_files ?? dataset.default_selected_files).map((file) => config.materials[file]);
      await request(`/sessions/${encodeURIComponent(session.id)}`, "PATCH", { selectedMaterialIds });
      const history: unknown[] = [];
      for (const turn of item.history.filter((turn) => turn.role === "user")) {
        history.push({ question: turn.content, ...await ask(session.id, turn.content) });
      }
      result.history = history;
      const response = await ask(session.id, item.question);
      Object.assign(result, response);
      result.forbiddenFragmentsFound = (item.forbidden_answer_fragments ?? []).filter((fragment) => response.answer.includes(fragment));
    } catch (error) {
      // Do not copy raw HTTP bodies or cookies into reports.
      result.error = error instanceof Error ? error.message : "Evaluation failed";
    }
    result.elapsedMs = Math.round(performance.now() - started);
    results.push(result);
    await save();
    console.log(`${item.id}: ${result.error ? "ERROR" : "collected; awaiting human score"}`);
  }
  if (results.some((result) => result.error)) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Evaluation failed"); process.exitCode = 1; });
