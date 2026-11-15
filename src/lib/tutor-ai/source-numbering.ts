export function buildChunkSourceNumbers(chunks: { chunkId: string; materialId: string }[]) {
  const materialNumbers = new Map<string, number>();
  const chunkNumbers = new Map<string, number>();
  for (const chunk of chunks) {
    if (!materialNumbers.has(chunk.materialId)) {
      materialNumbers.set(chunk.materialId, materialNumbers.size + 1);
    }
    chunkNumbers.set(chunk.chunkId, materialNumbers.get(chunk.materialId)!);
  }
  return chunkNumbers;
}

export function getCorrectionSourceNumbers(
  sources: ({ chunkId: string } | { kind: "page_range"; materialId: string; startPage: number; endPage: number })[],
  sourceNumbers: ReadonlyMap<string, number>,
  chunks: { chunkId: string; materialId: string; pageNumber: number }[] = [],
) {
  const numbers = sources.flatMap((source) => {
    if ("kind" in source && source.kind === "page_range") {
      return chunks.flatMap((chunk) => {
        if (chunk.materialId !== source.materialId || chunk.pageNumber < source.startPage || chunk.pageNumber > source.endPage) return [];
        const number = sourceNumbers.get(chunk.chunkId);
        return number === undefined ? [] : [number];
      });
    }
    const number = "chunkId" in source ? sourceNumbers.get(source.chunkId) : undefined;
    return number === undefined ? [] : [number];
  });
  return [...new Set(numbers)];
}
