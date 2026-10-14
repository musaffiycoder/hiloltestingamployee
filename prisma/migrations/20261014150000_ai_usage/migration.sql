-- AI chaqiruvlari sarfi (tokenlar va taxminiy narx) — analitika uchun.
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiUsage_at_idx" ON "AiUsage"("at");
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
