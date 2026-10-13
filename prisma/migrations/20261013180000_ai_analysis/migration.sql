-- AlterTable
ALTER TABLE "AttemptResult" ADD COLUMN "analysis" JSONB,
ADD COLUMN "analysisAt" TIMESTAMP(3),
ADD COLUMN "analysisModel" TEXT;
