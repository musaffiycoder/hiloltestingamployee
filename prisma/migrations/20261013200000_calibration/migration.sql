-- AlterTable
ALTER TABLE "Response" ADD COLUMN "aiScore" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "CalibrationRating" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationRating_responseId_raterId_key" ON "CalibrationRating"("responseId", "raterId");

-- AddForeignKey
ALTER TABLE "CalibrationRating" ADD CONSTRAINT "CalibrationRating_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationRating" ADD CONSTRAINT "CalibrationRating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
