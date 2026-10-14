-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('available', 'busy_in_meeting', 'out_of_office', 'on_leave', 'working_remotely');

-- CreateTable
CREATE TABLE "AvailabilityStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "Availability" NOT NULL DEFAULT 'available',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityStatus_userId_key" ON "AvailabilityStatus"("userId");

-- AddForeignKey
ALTER TABLE "AvailabilityStatus" ADD CONSTRAINT "AvailabilityStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
