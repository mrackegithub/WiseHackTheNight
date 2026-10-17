-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

