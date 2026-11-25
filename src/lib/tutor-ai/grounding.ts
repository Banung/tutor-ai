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

export function replaceSourceCitations(
  markdown: string,
  replaceCitation: (citation: string, sourceNumbers: number[]) => string
): string {
  const codeSegment = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;
  const citationGroup = /(?<![!\\])\[((?:Sumber\s+)?\d+(?:\s*,\s*(?:Sumber\s+)?\d+)*)\](?![\[(:])/gi;

  return markdown
    .split(codeSegment)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;

      return segment.replace(citationGroup, (citation, group: string) => {
        const sourceNumbers = group.split(",").map((part) =>
          Number(part.trim().replace(/^Sumber\s+/i, ""))
        );
        return replaceCitation(citation, [...new Set(sourceNumbers)]);
      });
    })
    .join("");
}

export function selectCitedSources<T>(answer: string, sources: T[]): T[] {
  const indices = new Set<number>();

  replaceSourceCitations(answer, (citation, sourceNumbers) => {
    for (const sourceNumber of sourceNumbers) {
      const index = sourceNumber - 1;
      if (index < 0 || index >= sources.length) {
        throw new Error("Rujukan sumber tidak valid. Silakan coba lagi.");
      }
      indices.add(index);
    }
    return citation;
  });

  return [...indices].map((index) => sources[index]);
}
