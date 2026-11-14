export type ConversationMessage = { senderType: string; content: string };

// Match only whole social messages. Mixed requests such as "Halo, jelaskan median"
// must still go through retrieval.
export function getSocialAnswer(question: string, name: string): string | null {
  const normalized = question.toLowerCase().replace(/[.!?,]+/g, " ").trim().replace(/\s+/g, " ");
  if (/^(halo|hai|hi|hello|assalamualaikum|selamat pagi|selamat siang|selamat sore|selamat malam)$/.test(normalized)) {
    return `Halo ${name || "Mahasiswa"}, aku siap membantu memahami materi course ini.`;
  }
  if (/^(terima kasih|makasih|thanks|thank you)( ya| banyak)?$/.test(normalized)) {
    return "Sama-sama! Jika ada materi yang ingin dibahas lagi, silakan tanyakan.";
  }
  return null;
}

export function selectCitedSources<T>(answer: string, sources: T[]): T[] {
  const indices = new Set<number>();
  for (const match of answer.matchAll(/\[Sumber\s+(\d+)\]/gi)) {
    const index = Number(match[1]) - 1;
    if (index < 0 || index >= sources.length) {
      throw new Error("Rujukan sumber tidak valid. Silakan coba lagi.");
    }
    indices.add(index);
  }
  return [...indices].map((index) => sources[index]);
}
