import { GoogleGenAI } from "@google/genai";
import {
  MATERIAL_EMBEDDING_DIMENSIONS,
  MATERIAL_EMBEDDING_MODEL,
} from "@/lib/material-processing/config";

let client: GoogleGenAI | null = null;
let embeddingModelConfirmed = false;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diatur di .env.");
  }

  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function formatDocumentForEmbedding(title: string, content: string) {
  if (MATERIAL_EMBEDDING_MODEL.includes("embedding-2")) {
    return `title: ${title || "none"} | text: ${content}`;
  }

  return content;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Gemini Embedding API tidak merespons setelah ${ms / 1000}s — timeout.`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function embedMaterialChunk(title: string, content: string) {
  const ai = getGeminiClient();
  const config: Record<string, string | number> = {
    outputDimensionality: MATERIAL_EMBEDDING_DIMENSIONS,
  };

  if (!MATERIAL_EMBEDDING_MODEL.includes("embedding-2")) {
    config.taskType = "RETRIEVAL_DOCUMENT";
  }

  let response;
  try {
    response = await withTimeout(
      ai.models.embedContent({
        model: MATERIAL_EMBEDDING_MODEL,
        contents: formatDocumentForEmbedding(title, content),
        config,
      }),
      45_000
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate")) {
      console.warn(`[embedding] RATE LIMIT Gemini API — tunggu sebelum retry. Detail: ${msg}`);
    }
    throw err;
  }

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini Embedding API tidak mengembalikan vector.");
  }

  if (!embeddingModelConfirmed) {
    console.log(`[embedding] Model dikonfirmasi: "${MATERIAL_EMBEDDING_MODEL}" → ${values.length} dimensi dari API`);
    embeddingModelConfirmed = true;
  }

  if (values.length !== MATERIAL_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Dimensi embedding ${values.length} tidak sesuai schema vector(${MATERIAL_EMBEDDING_DIMENSIONS}).`
    );
  }

  return values;
}

export function toPgVector(values: number[]) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}
