import { GoogleGenAI } from "@google/genai";
import {
  MATERIAL_EMBEDDING_DIMENSIONS,
  MATERIAL_EMBEDDING_MODEL,
} from "@/lib/material-processing/config";

const TUTOR_AI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash";

let client: GoogleGenAI | null = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diatur di .env.");
  }

  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Gemini API tidak merespons setelah ${ms / 1000}s - timeout.`)),
      ms
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function toPgVector(values: number[]) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

export async function embedTutorQuestion(question: string) {
  const ai = getGeminiClient();
  console.log(`\n[Gemini API] Memanggil embedContent (Embedding)...`);
  console.log(`[Gemini API] Model Embedding: ${MATERIAL_EMBEDDING_MODEL}`);
  
  const config: Record<string, string | number> = {
    outputDimensionality: MATERIAL_EMBEDDING_DIMENSIONS,
  };

  if (!MATERIAL_EMBEDDING_MODEL.includes("embedding-2")) {
    config.taskType = "RETRIEVAL_QUERY";
  }

  const response = await withTimeout(
    ai.models.embedContent({
      model: MATERIAL_EMBEDDING_MODEL,
      contents: MATERIAL_EMBEDDING_MODEL.includes("embedding-2")
        ? `task: question answering | query: ${question}`
        : question,
      config,
    }),
    45_000
  );

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini Embedding API tidak mengembalikan vector pertanyaan.");
  }

  if (values.length !== MATERIAL_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Dimensi embedding pertanyaan ${values.length} tidak sesuai schema vector(${MATERIAL_EMBEDDING_DIMENSIONS}).`
    );
  }

  return values;
}

export async function generateTutorAnswer(input: {
  systemInstruction: string;
  prompt: string;
}) {
  const ai = getGeminiClient();
  console.log(`\n[Gemini API] Memanggil generateContent...`);
  console.log(`[Gemini API] Model yang digunakan: ${TUTOR_AI_CHAT_MODEL}`);
  
  const response = await withTimeout(
    ai.models.generateContent({
      model: TUTOR_AI_CHAT_MODEL,
      contents: input.prompt,
      config: {
        systemInstruction: input.systemInstruction,
        temperature: 0.25,
        topP: 0.85,
        maxOutputTokens: 8192,
      },
    }),
    60_000
  );

  return response.text?.trim() || "Materi yang tersedia belum cukup untuk menjawab dengan pasti.";
}

export async function* streamTutorAnswer(input: {
  systemInstruction: string;
  prompt: string;
}): AsyncGenerator<string, void, unknown> {
  const ai = getGeminiClient();
  console.log(`\n[Gemini API] Memanggil generateContentStream...`);
  console.log(`[Gemini API] Model yang digunakan: ${TUTOR_AI_CHAT_MODEL}`);

  const response = await ai.models.generateContentStream({
    model: TUTOR_AI_CHAT_MODEL,
    contents: input.prompt,
    config: {
      systemInstruction: input.systemInstruction,
      temperature: 0.25,
      topP: 0.85,
      maxOutputTokens: 8192,
    },
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }
}
