import assert from "node:assert/strict";
import test from "node:test";
import { playServerSpeech, splitSpeechText } from "../src/lib/tutor-ai/chat-speech";

test("server TTS prefers sentence boundaries and preserves the full answer", () => {
  const first = "Ini kalimat pertama.";
  const remainder = "lanjut ".repeat(200).trim();
  const chunks = splitSpeechText(`${first} ${remainder}`);

  assert.equal(chunks[0], first);
  assert.equal(chunks.join(" "), `${first} ${remainder}`);
  assert.ok(chunks.every((chunk) => chunk.length <= 1200));
});

test("server TTS splits long tokens without breaking surrogate pairs", () => {
  const text = "a".repeat(1199) + "🙂".repeat(700);
  const chunks = splitSpeechText(text);

  assert.equal(chunks[0].length, 1199);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.every((chunk) => chunk.length <= 1200));
});

test("server TTS passes the abort signal to fetch and stops before playback", async (t) => {
  const controller = new AbortController();
  const fetchAudio = t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, options?: RequestInit) => {
    assert.equal(url, "/api/courses/course-1/tutor/tts");
    assert.equal(options?.method, "POST");
    assert.equal(options?.body, JSON.stringify({ text: "Jawaban" }));
    assert.equal(options?.signal, controller.signal);
    controller.abort();
    return new Response("audio", { headers: { "Content-Type": "audio/mpeg" } });
  });

  await assert.rejects(
    playServerSpeech("course-1", "Jawaban", controller.signal),
    { name: "AbortError" }
  );
  assert.equal(fetchAudio.mock.callCount(), 1);
});
