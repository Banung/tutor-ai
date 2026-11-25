const MAX_TTS_LENGTH = 1200;

export function splitSpeechText(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_TTS_LENGTH) {
    const prefix = remaining.slice(0, MAX_TTS_LENGTH);
    const sentenceEnd = [...prefix.matchAll(/[.!?]\s/g)].at(-1);
    const wordEnd = prefix.search(/\s\S*$/);
    let end = sentenceEnd
      ? sentenceEnd.index + 1
      : wordEnd > 0 ? wordEnd : MAX_TTS_LENGTH;

    // Keep surrogate pairs intact when splitting a long token.
    if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end -= 1;

    chunks.push(remaining.slice(0, end).trimEnd());
    remaining = remaining.slice(end).trimStart();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export function playBrowserSpeech(
  synthesis: SpeechSynthesis,
  utterance: SpeechSynthesisUtterance,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();

    function finish() {
      signal.removeEventListener("abort", abort);
      utterance.onend = null;
      utterance.onerror = null;
    }

    function abort() {
      finish();
      synthesis.cancel();
      reject(signal.reason);
    }

    utterance.onend = () => {
      finish();
      resolve();
    };
    utterance.onerror = ({ error }) => {
      finish();
      if (error === "canceled" || error === "interrupted") resolve();
      else reject(new Error(error));
    };
    signal.addEventListener("abort", abort, { once: true });

    try {
      synthesis.speak(utterance);
    } catch (error) {
      finish();
      reject(error);
    }
  });
}

async function playAudioBlob(blob: Blob, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const audio = new Audio();
  const url = URL.createObjectURL(blob);

  let abortPlayback: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Server audio playback failed"));
      abortPlayback = () => reject(signal.reason);
      signal.addEventListener("abort", abortPlayback, { once: true });
      audio.src = url;
      void audio.play().catch(reject);
    });
  } finally {
    if (abortPlayback) signal.removeEventListener("abort", abortPlayback);
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(url);
  }
}

export async function playServerSpeech(courseId: string, text: string, signal: AbortSignal) {
  for (const chunk of splitSpeechText(text)) {
    signal.throwIfAborted();
    const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/tutor/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk }),
      signal,
    });

    if (!response.ok) throw new Error(`Server TTS failed (${response.status})`);
    await playAudioBlob(await response.blob(), signal);
  }
}
