import { execFileSync } from "node:child_process";
import { ESLint } from "eslint";

const base = process.argv[2];
const diff = base ? [base, "HEAD"] : ["--cached"];
const paths = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", "-z", ...diff, "--"], {
  encoding: "utf8",
}).split("\0").filter((path) => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(path));

const eslint = new ESLint();
const results = [];
for (const filePath of paths) {
  if (await eslint.isPathIgnored(filePath)) continue;
  const source = execFileSync("git", ["show", base ? `HEAD:${filePath}` : `:${filePath}`], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  results.push(...await eslint.lintText(source, { filePath }));
}

const formatter = await eslint.loadFormatter("stylish");
const report = await formatter.format(results);
if (report) process.stdout.write(report);
if (results.some(({ errorCount }) => errorCount > 0)) process.exitCode = 1;
