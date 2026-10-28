-- Test (yopiq) va yozma (ochiq) savollar uchun alohida vaqt
ALTER TABLE "TestConfig" ADD COLUMN "closedTimeMin" INTEGER, ADD COLUMN "openTimeMin" INTEGER;
ALTER TABLE "Attempt" ADD COLUMN "closedTimeSec" INTEGER, ADD COLUMN "openTimeSec" INTEGER, ADD COLUMN "openStartedAt" TIMESTAMP(3);
-- Bitta umumiy vaqt endi ishlatilmaydi
UPDATE "TestConfig" SET "timeLimitMin" = NULL;
