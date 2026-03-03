import { PrismaClient, ComponentType, RoomType, Equipment, TermType, TimePreference, DayOfWeek } from '../generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing. Please check your .env file.');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Starting ENTERPRISE TIER 3: Massive Faculty Expansion & 75% Load Balancing...');

  // 1. CLEANUP
  console.log('🧹 Cleaning existing data...');
  await prisma.enrollment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.classComponent.deleteMany();
  await prisma.courseOffering.deleteMany();
  await prisma.courseComponentTemplate.deleteMany();
  await prisma.course.deleteMany();
  await prisma.term.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.professorUnavailability.deleteMany();
  await prisma.professor.deleteMany();
  await prisma.room.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.building.deleteMany();
  await prisma.campus.deleteMany();
  await prisma.globalScheduleSettings.deleteMany();

  // 2. GLOBAL SETTINGS
  await prisma.globalScheduleSettings.create({
    data: {
      universityOpenTime: '08:00',
      universityCloseTime: '18:30', 
      lunchBreakStartTime: '12:00',
      lunchBreakEndTime: '13:00',
      defaultRoomTurnaroundMins: 15,
      maxConsecutiveStudentHours: 4,
    },
  });

  // 3. CAMPUSES, BUILDINGS, & ROOMS
  console.log('🏢 Seeding Campuses & Perfectly Sized Rooms...');
  const mainCampus = await prisma.campus.create({ data: { name: 'Main Campus' } });

  const bldgsToCreate = [
    { name: 'Engineering Block', code: 'ENG' },
    { name: 'Science Hub', code: 'SCI' },
    { name: 'Business Tower', code: 'BUS' },
    { name: 'Medical Sciences', code: 'MED' }
  ];

  for (const b of bldgsToCreate) {
    const building = await prisma.building.create({
      data: { name: b.name, code: b.code, campusId: mainCampus.id }
    });

    const groundFloor = await prisma.floor.create({ data: { level: 'Ground', buildingId: building.id } });
    const firstFloor = await prisma.floor.create({ data: { level: '1', buildingId: building.id } });

    const roomData: any[] = [];
    
    // Classrooms (30 places)
    for (let i = 101; i <= 115; i++) {
      roomData.push({ name: `${b.code}-${i} (Classroom)`, capacity: 30, roomType: RoomType.CLASSROOM, equipment: [Equipment.WHITEBOARD], floorId: groundFloor.id });
    }
    // PC Labs (30 places)
    for (let i = 1; i <= 8; i++) {
      roomData.push({ name: `${b.code} PC Lab ${i}`, capacity: 30, roomType: RoomType.COMPUTER_LAB, equipment: [Equipment.COMPUTERS], floorId: firstFloor.id });
    }
    // Bi-Weekly Science Labs
    if (b.code === 'SCI' || b.code === 'MED') {
      for (let i = 1; i <= 10; i++) {
        roomData.push({ name: `Chemistry Lab ${b.code}-${i} (BiWeekly)`, capacity: 30, roomType: RoomType.CHEMISTRY_LAB, equipment: [Equipment.CHEMISTRY_HOOD], floorId: groundFloor.id });
        roomData.push({ name: `Physics Lab ${b.code}-${i} (BiWeekly)`, capacity: 30, roomType: RoomType.CHEMISTRY_LAB, equipment: [], floorId: firstFloor.id });
      }
    }
    await prisma.room.createMany({ data: roomData });
  }

  // 4. MASSIVE PROFESSOR EXPANSION
  console.log('👨‍🏫 Seeding 300 Faculty Members to provide AI breathing room...');
  
  await prisma.professor.create({
    data: {
      name: 'Dr. Strict Monday',
      department: 'Specialized Faculty',
      maxHoursPerWeek: 12, 
      timePreference: TimePreference.NO_PREFERENCE,
      isStrictTimeRequirement: true, 
      unavailability: {
        create: [
          { dayOfWeek: DayOfWeek.TUESDAY, startTime: '08:00', endTime: '20:00' },
          { dayOfWeek: DayOfWeek.WEDNESDAY, startTime: '08:00', endTime: '20:00' },
          { dayOfWeek: DayOfWeek.THURSDAY, startTime: '08:00', endTime: '20:00' },
          { dayOfWeek: DayOfWeek.FRIDAY, startTime: '08:00', endTime: '20:00' },
          { dayOfWeek: DayOfWeek.SATURDAY, startTime: '08:00', endTime: '20:00' }
        ]
      }
    }
  });

  const profData: any[] = [];
  
  // 150 Core Faculty (Max 40 hours)
  for (let i = 1; i <= 150; i++) {
    profData.push({
      name: `Dr. Core Faculty ${i}`,
      department: 'University Faculty',
      maxHoursPerWeek: 40, 
      timePreference: TimePreference.NO_PREFERENCE,
      isStrictTimeRequirement: false
    });
  }

  // 150 Adjunct / Relief Faculty (Max 15 hours - Just here to take 1 or 2 classes!)
  for (let i = 1; i <= 150; i++) {
    profData.push({
      name: `Adjunct Relief ${i}`,
      department: 'Support Staff',
      maxHoursPerWeek: 15, 
      timePreference: TimePreference.NO_PREFERENCE,
      isStrictTimeRequirement: false
    });
  }
  
  await prisma.professor.createMany({ data: profData });
  const allProfs = await prisma.professor.findMany();

  // 5. TERMS
  console.log('📅 Seeding Semester 1 and Semester 2...');
  const fall26 = await prisma.term.create({ data: { name: 'Fall 2026', type: TermType.SEMESTER_1, startDate: new Date('2026-09-01T00:00:00Z'), endDate: new Date('2026-12-20T00:00:00Z') } });
  const spring27 = await prisma.term.create({ data: { name: 'Spring 2027', type: TermType.SEMESTER_2, startDate: new Date('2027-01-10T00:00:00Z'), endDate: new Date('2027-05-15T00:00:00Z') } });

  // 6. COHORTS
  console.log('👥 Seeding Strict 30-Student Cohorts (5 Groups per major)...');
  const cohortPrefixes = ['SWE', 'CS', 'BUS', 'MED', 'ENG'];
  const cohortData: any[] = [];
  
  for (const prefix of cohortPrefixes) {
    for (const group of ['Grp 1', 'Grp 2', 'Grp 3', 'Grp 4', 'Grp 5']) {
      cohortData.push({ name: `${prefix} - Y1 ${group}`, hc: 30 });
      cohortData.push({ name: `${prefix} - Y2 ${group}`, hc: 30 });
    }
  }

  const createdCohorts: Record<string, any> = {};
  for (const c of cohortData) {
    createdCohorts[c.name] = await prisma.cohort.create({ data: { name: c.name, headcount: c.hc, currentSemester: TermType.SEMESTER_1 } });
  }

  // 7. COURSES 
  console.log('📘 Seeding Course Catalog with dynamic durations (1H, 1.5H, 2H, 3H)...');
  
  const curriculumData = [
    { name: 'Calculus I', credits: 4, type: 'STANDARD' },
    { name: 'Algebra', credits: 3, type: 'STANDARD' },
    { name: 'Intro to Programming', credits: 4, type: 'CUSTOM_2H_2H' }, 
    { name: 'Digital Logic', credits: 3, type: 'STANDARD' },
    { name: 'Physics I', credits: 4, type: 'CUSTOM_1H_3H' }, 
    { name: 'Chemistry I', credits: 3, type: 'SCIENCE' },
    { name: 'Calculus II', credits: 4, type: 'STANDARD' },
    { name: 'Discrete Math', credits: 3, type: 'STANDARD' },
    { name: 'Data Structures', credits: 4, type: 'CUSTOM_2H_2H' },
    { name: 'Web Dev', credits: 3, type: 'STANDARD' },
    { name: 'Physics II', credits: 4, type: 'CUSTOM_1H_3H' },
    { name: 'Chemistry II', credits: 3, type: 'SCIENCE' },
    { name: 'Databases', credits: 4, type: 'STANDARD' },
    { name: 'OS', credits: 4, type: 'STANDARD' },
    { name: 'Computer Architecture', credits: 3, type: 'STANDARD' },
    { name: 'Microecon', credits: 3, type: 'STANDARD' },
    { name: 'Marketing', credits: 3, type: 'STANDARD' },
    { name: 'Statistics', credits: 4, type: 'STANDARD' },
    { name: 'Networks', credits: 4, type: 'STANDARD' },
    { name: 'Security', credits: 4, type: 'STANDARD' },
    { name: 'Agile Project Mgmt', credits: 3, type: 'STANDARD' },
    { name: 'Macroecon', credits: 3, type: 'STANDARD' },
    { name: 'HR Mgmt', credits: 3, type: 'STANDARD' },
    { name: 'Finance', credits: 4, type: 'STANDARD' }
  ];

  const createdCourses: Record<string, any> = {};
  
  for (let i = 0; i < curriculumData.length; i++) {
    const cData = curriculumData[i];
    const comps: any[] = [];

    if (cData.type === 'CUSTOM_2H_2H') {
      comps.push({ type: ComponentType.LECTURE, requiresRoomType: RoomType.CLASSROOM, totalComponentHours: 30, hoursPerSession: 2.0, requiredEquipment: [Equipment.WHITEBOARD] });
      comps.push({ type: ComponentType.TD, requiresRoomType: RoomType.COMPUTER_LAB, totalComponentHours: 30, hoursPerSession: 2.0, requiredEquipment: [Equipment.COMPUTERS] });
    } 
    else if (cData.type === 'CUSTOM_1H_3H') {
      comps.push({ type: ComponentType.LECTURE, requiresRoomType: RoomType.CLASSROOM, totalComponentHours: 15, hoursPerSession: 1.0, requiredEquipment: [Equipment.WHITEBOARD] });
      comps.push({ type: ComponentType.TP, requiresRoomType: RoomType.CHEMISTRY_LAB, totalComponentHours: 45, hoursPerSession: 3.0, requiredEquipment: [] });
    } 
    else if (cData.credits === 4) {
      comps.push({ type: ComponentType.LECTURE, requiresRoomType: RoomType.CLASSROOM, totalComponentHours: 30, hoursPerSession: 1.5, requiredEquipment: [Equipment.WHITEBOARD] });
      comps.push({ type: ComponentType.LECTURE, requiresRoomType: RoomType.CLASSROOM, totalComponentHours: 30, hoursPerSession: 1.5, requiredEquipment: [Equipment.WHITEBOARD] });
      if (cData.type === 'SCIENCE') comps.push({ type: ComponentType.TP, requiresRoomType: RoomType.CHEMISTRY_LAB, totalComponentHours: 15, hoursPerSession: 1.5, requiredEquipment: [] });
      else comps.push({ type: ComponentType.TD, requiresRoomType: RoomType.COMPUTER_LAB, totalComponentHours: 15, hoursPerSession: 1.5, requiredEquipment: [Equipment.COMPUTERS] });
    } 
    else { 
      comps.push({ type: ComponentType.LECTURE, requiresRoomType: RoomType.CLASSROOM, totalComponentHours: 30, hoursPerSession: 1.5, requiredEquipment: [Equipment.WHITEBOARD] });
      if (cData.type === 'SCIENCE') comps.push({ type: ComponentType.TP, requiresRoomType: RoomType.CHEMISTRY_LAB, totalComponentHours: 15, hoursPerSession: 1.5, requiredEquipment: [] });
      else comps.push({ type: ComponentType.TD, requiresRoomType: RoomType.COMPUTER_LAB, totalComponentHours: 15, hoursPerSession: 1.5, requiredEquipment: [Equipment.COMPUTERS] });
    }

    createdCourses[cData.name] = await prisma.course.create({
      data: {
        code: `CRS${100 + i}`, 
        title: cData.name, 
        credits: cData.credits, 
        totalHours: comps.reduce((sum, c) => sum + c.totalComponentHours, 0), 
        offeredInTerms: [TermType.SEMESTER_1, TermType.SEMESTER_2],
        componentsTemplate: { create: comps }
      },
      include: { componentsTemplate: true }
    });
  }

  // 8. 75% LOAD BALANCING ALGORITHM
  console.log('⚙️ Assigning Fixed Curriculums with a 75% Load Target limit...');
  
  const profHoursTracker: Record<string, Record<string, number>> = { [fall26.id]: {}, [spring27.id]: {} };
  const courseProfGroupCount: Record<string, Record<string, Record<string, number>>> = { [fall26.id]: {}, [spring27.id]: {} };
  
  allProfs.forEach(p => {
    profHoursTracker[fall26.id][p.id] = 0;
    profHoursTracker[spring27.id][p.id] = 0;
  });

  function assignProfessorToGroup(termId: string, courseId: string, requiredHours: number): string {
    if (!courseProfGroupCount[termId][courseId]) courseProfGroupCount[termId][courseId] = {};
    
    // 🚨 THE FIX: Force the AI to leave 25% of the professor's schedule completely empty!
    const MAX_LOAD_FACTOR = 0.75; 

    const existingProfIds = Object.keys(courseProfGroupCount[termId][courseId]);
    for (const pId of existingProfIds) {
      const p = allProfs.find(prof => prof.id === pId)!;
      if (courseProfGroupCount[termId][courseId][pId] < 4 && (profHoursTracker[termId][pId] + requiredHours) <= (p.maxHoursPerWeek * MAX_LOAD_FACTOR)) {
        courseProfGroupCount[termId][courseId][pId]++;
        profHoursTracker[termId][pId] += requiredHours;
        return pId;
      }
    }

    const availableProfs = allProfs.filter(p => (profHoursTracker[termId][p.id] + requiredHours) <= (p.maxHoursPerWeek * MAX_LOAD_FACTOR));
    if (availableProfs.length === 0) throw new Error(`Ran out of Professor hours in Term ${termId} even with 300 staff!`);

    const randomProf = availableProfs[Math.floor(Math.random() * availableProfs.length)];
    courseProfGroupCount[termId][courseId][randomProf.id] = 1;
    profHoursTracker[termId][randomProf.id] += requiredHours;
    
    return randomProf.id;
  }

  const CURRICULUM = {
    Y1_SEMESTER_1: ['Calculus I', 'Algebra', 'Intro to Programming', 'Digital Logic', 'Physics I', 'Chemistry I'],   
    Y1_SEMESTER_2: ['Calculus II', 'Discrete Math', 'Data Structures', 'Web Dev', 'Physics II', 'Chemistry II'],  
    Y2_SEMESTER_1: ['Databases', 'OS', 'Computer Architecture', 'Microecon', 'Marketing', 'Statistics'], 
    Y2_SEMESTER_2: ['Networks', 'Security', 'Agile Project Mgmt', 'Macroecon', 'HR Mgmt', 'Finance']  
  };

  const baseMajors = ['SWE', 'CS', 'BUS', 'MED', 'ENG'];
  
  for (const major of baseMajors) {
    for (const year of ['Y1', 'Y2']) {
      for (let g = 1; g <= 5; g++) {
        const cohortName = `${major} - ${year} Grp ${g}`;
        const cohort = createdCohorts[cohortName];

        const s1Courses = year === 'Y1' ? CURRICULUM.Y1_SEMESTER_1 : CURRICULUM.Y2_SEMESTER_1;
        for (const courseName of s1Courses) {
          const course = createdCourses[courseName];
          const weeklyHours = course.componentsTemplate.reduce((sum: number, t: any) => sum + t.hoursPerSession, 0);
          const assignedProfId = assignProfessorToGroup(fall26.id, course.id, weeklyHours);

          await prisma.courseOffering.create({
            data: {
              termId: fall26.id, courseId: course.id, cohortId: cohort.id,
              classes: {
                create: course.componentsTemplate.map((t: any) => ({
                  type: t.type, 
                  durationMinutes: Math.round(t.hoursPerSession * 60), 
                  requiresRoomType: t.requiresRoomType, 
                  requiredEquipment: t.requiredEquipment, 
                  isRecurringWeekly: true,
                  assignedProfessorId: assignedProfId
                }))
              }
            }
          });
        }

        const s2Courses = year === 'Y1' ? CURRICULUM.Y1_SEMESTER_2 : CURRICULUM.Y2_SEMESTER_2;
        for (const courseName of s2Courses) {
          const course = createdCourses[courseName];
          const weeklyHours = course.componentsTemplate.reduce((sum: number, t: any) => sum + t.hoursPerSession, 0);
          const assignedProfId = assignProfessorToGroup(spring27.id, course.id, weeklyHours);

          await prisma.courseOffering.create({
            data: {
              termId: spring27.id, courseId: course.id, cohortId: cohort.id,
              classes: {
                create: course.componentsTemplate.map((t: any) => ({
                  type: t.type, 
                  durationMinutes: Math.round(t.hoursPerSession * 60), 
                  requiresRoomType: t.requiresRoomType, 
                  requiredEquipment: t.requiredEquipment, 
                  isRecurringWeekly: true,
                  assignedProfessorId: assignedProfId
                }))
              }
            }
          });
        }
      }
    }
  }

  // 9. STUDENT GENERATION 
  console.log('🧑‍🎓 Generating Individual Students...');
  const studentsToCreate: any[] = [];
  let studentCounter = 1;

  for (const [cohortName, cohort] of Object.entries(createdCohorts)) {
    for (let i = 0; i < (cohort as any).headcount; i++) {
      studentsToCreate.push({
        firstName: `Student${studentCounter}`,
        lastName: `Major_${cohortName.split(' - ')[0]}`,
        email: `student${studentCounter}@university.edu`,
        cohortId: (cohort as any).id
      });
      studentCounter++;
    }
  }

  const chunkSize = 5000;
  for (let i = 0; i < studentsToCreate.length; i += chunkSize) {
    await prisma.student.createMany({ data: studentsToCreate.slice(i, i + chunkSize) });
  }
  const allStudents = await prisma.student.findMany();

  // 10. ENROLLMENTS 
  console.log('📝 Enrolling students...');
  const allOfferings = await prisma.courseOffering.findMany();
  const enrollmentsToCreate: any[] = [];

  for (const offering of allOfferings) {
    const cohortStudents = allStudents.filter(s => s.cohortId === offering.cohortId);
    for (const student of cohortStudents) {
      enrollmentsToCreate.push({ studentId: student.id, courseOfferingId: offering.id });
    }
  }

  for (let i = 0; i < enrollmentsToCreate.length; i += chunkSize) {
    await prisma.enrollment.createMany({ data: enrollmentsToCreate.slice(i, i + chunkSize) });
  }

  console.log('✅✅✅ Final Enterprise Seeding Complete! Ready for the AI to schedule.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });