-- Test konstruktori: lavozim testining tarkibi va vaqt chegarasi.
CREATE TABLE "TestConfig" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "perCompetency" JSONB NOT NULL DEFAULT '{}',
    "timeLimitMin" INTEGER,
    "order" TEXT NOT NULL DEFAULT 'competency',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "TestConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TestConfig_positionId_key" ON "TestConfig"("positionId");
ALTER TABLE "TestConfig" ADD CONSTRAINT "TestConfig_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attempt" ADD COLUMN "timeLimitSec" INTEGER;
