import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractPdfPages } from "../../src/lib/material-processing/pdf";

test("digital PDF preserves native text once and skips full-page OCR", async () => {
  const pages = await extractPdfPages(await readFile("tests/fixtures/ai/01-statistika-digital.pdf"));
  assert.equal(pages.length, 3);
  assert.ok(pages.every((page) => !page.imageOcrAttempted));
  assert.ok(pages.every((page) => page.finalText === page.embeddedText));
  assert.match(pages[1].finalText, /Nilai akhir Rani adalah 78/);
  assert.equal(pages[1].finalText.split("Nilai akhir Rani adalah 78").length - 1, 1);
});

test("image-only PDF is actually OCRed and retains known facts", async () => {
  const pages = await extractPdfPages(await readFile("tests/fixtures/ai/02-praktikum-scan.pdf"));
  assert.equal(pages.length, 1);
  assert.equal(pages[0].embeddedText, "");
  assert.equal(pages[0].imageOcrAttempted, true);
  assert.match(pages[0].finalText, /NUSA-17/);
  assert.match(pages[0].finalText, /9 menit/);
});
