/*
  Warnings:

  - The values [DOWNLOADING] on the enum `DownloadStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."OperationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'PARTIAL', 'FAILED', 'SKIPPED');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."DownloadStatus_new" AS ENUM ('PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'PARTIAL', 'FAILED', 'SKIPPED');
ALTER TABLE "public"."download_sessions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."download_sessions" ALTER COLUMN "status" TYPE "public"."DownloadStatus_new" USING ("status"::text::"public"."DownloadStatus_new");
ALTER TYPE "public"."DownloadStatus" RENAME TO "DownloadStatus_old";
ALTER TYPE "public"."DownloadStatus_new" RENAME TO "DownloadStatus";
DROP TYPE "public"."DownloadStatus_old";
ALTER TABLE "public"."download_sessions" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
