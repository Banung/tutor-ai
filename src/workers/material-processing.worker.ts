import "dotenv/config";
import prisma from "@/lib/prisma";
import { processMaterial } from "@/lib/material-processing/pipeline";
import { MATERIAL_WORKER_POLL_INTERVAL_MS } from "@/lib/material-processing/config";
import { processTutorAlignment, queueStaleAlignmentRuns, reserveQueuedAlignment } from "@/lib/tutor-ai/alignment-runner";

type ReservedMaterial = {
  id: string;
  title: string;
  processingStatus: string;
};

let shuttingDown = false;

async function reserveQueuedMaterial(workerId: string) {
  const rows = await prisma.$queryRaw<ReservedMaterial[]>`
    UPDATE "material"
    SET
      "processingStatus" = 'processing',
      "processingProgress" = 5,
      "processingStartedAt" = NOW(),
      "processingJobId" = ${workerId},
      "processingError" = NULL,
      "isProcessed" = false
    WHERE "id" = (
      SELECT "id"
      FROM "material"
      WHERE "materialType" = 'file'
        AND "storagePath" IS NOT NULL
        AND "storagePath" NOT LIKE '/%'
        AND LOWER("fileName") LIKE '%.pdf'
        AND (
          "processingStatus" IN ('queued', 'uploaded')
          OR (
            "processingStatus" IN ('processing', 'extracting', 'ocr', 'chunking', 'embedding', 'indexing')
            AND "processingStartedAt" < NOW() - INTERVAL '2 hours'
          )
        )
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING "id", "title", "processingStatus"
  `;

  return rows[0] ?? null;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function workLoop() {
  const workerId = `db-worker:${process.pid}:${crypto.randomUUID()}`;
  const runOnce = process.argv.includes("--once");
  console.log(`Material DB worker started as ${workerId}`);

  while (!shuttingDown) {
    try {
      await queueStaleAlignmentRuns();
    } catch (error) {
      console.error("Could not queue stale tutor alignments", error);
    }

    const [material, alignment] = await Promise.all([
      reserveQueuedMaterial(workerId),
      reserveQueuedAlignment(workerId),
    ]);

    if (!material && !alignment) {
      if (runOnce) break;
      await wait(MATERIAL_WORKER_POLL_INTERVAL_MS);
      continue;
    }

    const tasks: Promise<void>[] = [];
    if (material) tasks.push((async () => {
      try {
        console.log(`Processing material ${material.id} (${material.title})`);
        await processMaterial(material.id);
        console.log(`Material processing completed for ${material.id}`);
      } catch (error) {
        console.error(`Material processing failed for ${material.id}`, error);
        if (runOnce) process.exitCode = 1;
      }
    })());
    if (alignment) tasks.push((async () => {
      try {
        console.log(`Processing tutor alignment ${alignment.id}`);
        await processTutorAlignment(alignment.id);
        console.log(`Tutor alignment completed for ${alignment.id}`);
      } catch (error) {
        console.error(`Tutor alignment failed for ${alignment.id}`, error);
        if (runOnce) process.exitCode = 1;
      }
    })());
    await Promise.all(tasks);

    if (runOnce) break;
  }

  await prisma.$disconnect();
}

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Closing material DB worker...`);
  shuttingDown = true;
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in material worker:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection in material worker:", reason);
  process.exit(1);
});

void workLoop().catch(async (error) => {
  console.error("Material worker failed:", error);
  process.exitCode = 1;
  await prisma.$disconnect();
});
