import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { TutorAiServiceError } from "./service";

// Both feedback edits and lecturer decisions use the same isolation level.
export async function feedbackTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code);
      if (!retryable) throw error;
      if (attempt === 2) throw new TutorAiServiceError("Data sedang berubah. Muat ulang dan coba lagi.", 409);
    }
  }
  throw new Error("Unreachable transaction retry");
}
