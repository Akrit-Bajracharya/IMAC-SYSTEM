-- CreateTable
CREATE TABLE "WorkRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeWorkRole" (
    "id" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "workRoleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeWorkRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkRole_name_key" ON "WorkRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeWorkRole_employeeProfileId_workRoleId_key" ON "EmployeeWorkRole"("employeeProfileId", "workRoleId");

-- AddForeignKey
ALTER TABLE "EmployeeWorkRole" ADD CONSTRAINT "EmployeeWorkRole_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWorkRole" ADD CONSTRAINT "EmployeeWorkRole_workRoleId_fkey" FOREIGN KEY ("workRoleId") REFERENCES "WorkRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
