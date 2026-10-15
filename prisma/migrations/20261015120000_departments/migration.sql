-- Bo'limlar jadvali va lavozimning bo'limga bog'lanishi
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

ALTER TABLE "Position" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Position" ADD CONSTRAINT "Position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mavjud matnli bo'limlardan yozuvlar yaratish va bog'lash
INSERT INTO "Department" ("id", "name", "sortOrder")
SELECT 'dep_' || md5("department"), "department", ROW_NUMBER() OVER (ORDER BY "department")
FROM (SELECT DISTINCT "department" FROM "Position") d;
UPDATE "Position" p SET "departmentId" = d."id" FROM "Department" d WHERE d."name" = p."department";
