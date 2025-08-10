-- AlterTable
ALTER TABLE "public"."upload_sessions" ADD COLUMN     "conflictsLogged" INTEGER DEFAULT 0,
ADD COLUMN     "conflictsRenamed" INTEGER DEFAULT 0,
ADD COLUMN     "conflictsSkipped" INTEGER DEFAULT 0,
ADD COLUMN     "realUploadedFiles" INTEGER DEFAULT 0,
ADD COLUMN     "skippedFilesCount" INTEGER DEFAULT 0;
