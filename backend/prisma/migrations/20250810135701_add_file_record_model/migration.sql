-- CreateTable
CREATE TABLE "public"."file_records" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "folderPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mtimeMs" BIGINT NOT NULL,
    "hash" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_records_topicId_fileName_key" ON "public"."file_records"("topicId", "fileName");

-- AddForeignKey
ALTER TABLE "public"."file_records" ADD CONSTRAINT "file_records_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
