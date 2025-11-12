-- CreateEnum
CREATE TYPE "public"."DownloadStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'PAUSED', 'COMPLETED', 'PARTIAL', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "public"."download_sessions" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "targetPath" TEXT NOT NULL,
    "status" "public"."DownloadStatus" NOT NULL DEFAULT 'PENDING',
    "selectedFiles" JSONB NOT NULL DEFAULT '[]',
    "totalFiles" INTEGER NOT NULL,
    "downloadedFiles" INTEGER NOT NULL DEFAULT 0,
    "currentFile" TEXT,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "realDownloadedFiles" INTEGER DEFAULT 0,
    "skippedFilesCount" INTEGER DEFAULT 0,

    CONSTRAINT "download_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."download_sessions" ADD CONSTRAINT "download_sessions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
