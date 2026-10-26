-- CreateEnum
CREATE TYPE "WorkLogStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "WorkLogDay" (
    "id" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "WorkLogStatus" NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLogDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLogEntry" (
    "id" TEXT NOT NULL,
    "workLogDayId" TEXT NOT NULL,
    "workRoleId" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkLogDay_employeeProfileId_date_key" ON "WorkLogDay"("employeeProfileId", "date");

-- AddForeignKey
ALTER TABLE "WorkLogDay" ADD CONSTRAINT "WorkLogDay_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLogEntry" ADD CONSTRAINT "WorkLogEntry_workLogDayId_fkey" FOREIGN KEY ("workLogDayId") REFERENCES "WorkLogDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLogEntry" ADD CONSTRAINT "WorkLogEntry_workRoleId_fkey" FOREIGN KEY ("workRoleId") REFERENCES "WorkRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
