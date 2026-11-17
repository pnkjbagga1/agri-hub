-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "dateNote" TEXT,
ADD COLUMN     "posterUrl" TEXT,
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'America/Vancouver';
