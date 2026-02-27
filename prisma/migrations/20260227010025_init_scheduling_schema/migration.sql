-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "TermType" AS ENUM ('SEMESTER_1', 'SEMESTER_2', 'SUMMER');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('AMPHI', 'CLASSROOM', 'COMPUTER_LAB', 'WORKSHOP', 'CHEMISTRY_LAB');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('LECTURE', 'TD', 'TP');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('COMPUTERS', 'MAC_COMPUTERS', 'PROJECTOR', 'CHEMISTRY_HOOD', 'WHITEBOARD', 'SMARTBOARD');

-- CreateEnum
CREATE TYPE "TimePreference" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'NO_PREFERENCE');

-- CreateTable
CREATE TABLE "GlobalScheduleSettings" (
    "id" TEXT NOT NULL,
    "universityOpenTime" TEXT NOT NULL,
    "universityCloseTime" TEXT NOT NULL,
    "lunchBreakStartTime" TEXT NOT NULL,
    "lunchBreakEndTime" TEXT NOT NULL,
    "defaultRoomTurnaroundMins" INTEGER NOT NULL,
    "maxConsecutiveStudentHours" INTEGER NOT NULL,

    CONSTRAINT "GlobalScheduleSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "roomType" "RoomType" NOT NULL,
    "equipment" "Equipment"[],
    "floorId" TEXT NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Professor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "maxHoursPerWeek" DOUBLE PRECISION NOT NULL,
    "timePreference" "TimePreference" NOT NULL DEFAULT 'NO_PREFERENCE',

    CONSTRAINT "Professor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessorUnavailability" (
    "id" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,

    CONSTRAINT "ProfessorUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "currentSemester" "TermType" NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TermType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "offeredInTerms" "TermType"[],

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseComponentTemplate" (
    "id" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "totalComponentHours" DOUBLE PRECISION NOT NULL,
    "hoursPerSession" DOUBLE PRECISION NOT NULL,
    "requiresRoomType" "RoomType" NOT NULL,
    "requiredEquipment" "Equipment"[],
    "mustFollowType" "ComponentType",
    "courseId" TEXT NOT NULL,

    CONSTRAINT "CourseComponentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassComponent" (
    "id" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "requiresRoomType" "RoomType" NOT NULL,
    "requiredEquipment" "Equipment"[],
    "mustFollowType" "ComponentType",
    "courseOfferingId" TEXT NOT NULL,
    "assignedProfessorId" TEXT,
    "assignedRoomId" TEXT,
    "dayOfWeek" "DayOfWeek",
    "startTime" TEXT,
    "endTime" TEXT,
    "isRecurringWeekly" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ClassComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorUnavailability" ADD CONSTRAINT "ProfessorUnavailability_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseComponentTemplate" ADD CONSTRAINT "CourseComponentTemplate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassComponent" ADD CONSTRAINT "ClassComponent_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassComponent" ADD CONSTRAINT "ClassComponent_assignedProfessorId_fkey" FOREIGN KEY ("assignedProfessorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassComponent" ADD CONSTRAINT "ClassComponent_assignedRoomId_fkey" FOREIGN KEY ("assignedRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
