/*
  Warnings:

  - You are about to drop the `telegram_channels` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."UploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'PAUSED', 'COMPLETED', 'PARTIAL', 'FAILED');

-- DropForeignKey
ALTER TABLE "public"."file_sync_events" DROP CONSTRAINT "file_sync_events_channelId_fkey";

-- DropTable
DROP TABLE "public"."telegram_channels";

-- CreateTable
CREATE TABLE "public"."channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."folder_topic_links" (
    "id" TEXT NOT NULL,
    "folderPath" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folder_topic_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."upload_sessions" (
    "id" TEXT NOT NULL,
    "folderPath" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "public"."UploadStatus" NOT NULL DEFAULT 'PENDING',
    "totalFiles" INTEGER NOT NULL,
    "uploadedFiles" INTEGER NOT NULL DEFAULT 0,
    "currentFile" TEXT,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."telegram_sessions" (
    "id" TEXT NOT NULL,
    "stringSession" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "folder_topic_links_folderPath_topicId_key" ON "public"."folder_topic_links"("folderPath", "topicId");

-- AddForeignKey
ALTER TABLE "public"."topics" ADD CONSTRAINT "topics_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."folder_topic_links" ADD CONSTRAINT "folder_topic_links_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."upload_sessions" ADD CONSTRAINT "upload_sessions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."file_sync_events" ADD CONSTRAINT "file_sync_events_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
