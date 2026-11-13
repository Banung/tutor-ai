import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execute = promisify(execFile);

test("evaluation is a no-network dry run unless explicitly enabled", async () => {
  const { stdout } = await execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/evaluate-ai.ts"]);
  const plan = JSON.parse(stdout);
  assert.equal(plan.kind, "dry-run");
  assert.equal(plan.cases, 25);
});

test("HTTP evaluation collects real turns, metadata and provenance without inventing scores", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "tutor-evaluation-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const materials = {
    "01-statistika-digital.pdf": "digital",
    "02-praktikum-scan.pdf": "scan",
    "04-untrusted-document.pdf": "untrusted",
  };
  let sessionCount = 0;
  const questions: string[] = [];
  const server = createServer(async (request, response) => {
    assert.equal(request.headers.cookie, "synthetic-cookie");
    response.setHeader("Content-Type", "application/json");
    if (request.url?.endsWith("/tutor")) {
      response.end(JSON.stringify({ readyMaterials: Object.entries(materials).map(([fileName, id]) => ({ fileName, id })) }));
    } else if (request.url?.endsWith("/sessions")) {
      sessionCount++;
      response.end(JSON.stringify({ id: `session-${sessionCount}` }));
    } else if (request.method === "PATCH") {
      response.end("{}");
    } else if (request.url?.endsWith("/messages")) {
      let body = "";
      for await (const part of request) body += part;
      questions.push(JSON.parse(body).content);
      response.setHeader("Content-Type", "text/event-stream");
      response.end('event: text\ndata: {"text":"Jawaban aktual dari server pengujian."}\n\nevent: metadata\ndata: {"ragSources":{"sources":[]},"responseTimeMs":10}\n\nevent: done\ndata: {"sessionId":"test"}\n\n');
    } else { response.statusCode = 404; response.end("{}"); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const config = join(directory, "config.json");
  const output = join(directory, "result.json");
  await writeFile(config, JSON.stringify({ baseUrl: `http://127.0.0.1:${address.port}`, courseId: "synthetic-course", materials }));
  await execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/evaluate-ai.ts", "--live", "--config", config, "--out", output, "--limit", "6"], { env: { ...process.env, AI_EVAL_COOKIE: "synthetic-cookie" } });
  const resultText = await readFile(output, "utf8");
  assert.doesNotMatch(resultText, /synthetic-cookie/);
  const report = JSON.parse(resultText);
  assert.equal(report.results.length, 6);
  assert.equal(sessionCount, 6);
  assert.match(report.revision, /^[a-f0-9]{40}$/);
  assert.match(report.fixtureHash, /^[a-f0-9]{64}$/);
  assert.equal(report.results[0].answer, "Jawaban aktual dari server pengujian.");
  assert.equal(report.results[0].scores, null);
  assert.equal(report.results[5].history.length, 1);
  assert.equal(questions.at(-1), "Kenapa begitu?");
});
