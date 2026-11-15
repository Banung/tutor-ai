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
  sources: { chunkId: string }[],
  sourceNumbers: ReadonlyMap<string, number>,
) {
  const numbers = sources.flatMap((source) => {
    const number = sourceNumbers.get(source.chunkId);
    return number === undefined ? [] : [number];
  });
  return [...new Set(numbers)];
}
