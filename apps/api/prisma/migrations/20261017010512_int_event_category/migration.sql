-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('CLASS', 'STUDY', 'WORK', 'OTHER');

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "category" "EventCategory";
