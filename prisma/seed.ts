import { PrismaClient, ComponentType, RoomType, Equipment, TermType, TimePreference } from '../generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

// 1. Load the environment variables so we get DATABASE_URL
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing. Please check your .env file.');
}

// 2. Set up the standard Postgres connection pool and Prisma adapter
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// 3. Pass the adapter into the PrismaClient!
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Starting ENTERPRISE TIER 3: Fixed Curriculums, Max 30 Students, Bi-Weekly Science Labs...');

  // 1. CLEANUP (Added Enrollment & Student to the wipe list!)
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
  console.log('⚙️ Seeding Settings...');
  await prisma.globalScheduleSettings.create({
    data: {
      universityOpenTime: '08:00',
      universityCloseTime: '20:00', 
      lunchBreakStartTime: '12:00',
      lunchBreakEndTime: '13:00',
      defaultRoomTurnaroundMins: 15,
      maxConsecutiveStudentHours: 4,
    },
  });

  // 3. LOCATIONS
  console.log('🏢 Seeding Campuses & Perfectly Sized Rooms...');
  const campusesData = [
    { name: 'North Tech Campus', buildings: [{ name: 'Engineering Block', code: 'ENG', floors: ['Ground', '1'] }, { name: 'Science Hub', code: 'SCI', floors: ['Ground', '1'] }] },
    { name: 'South Downtown Campus', buildings: [{ name: 'Business Tower', code: 'BUS', floors: ['Ground'] }] },
    { name: 'West Medical Campus', buildings: [{ name: 'Medical Sciences', code: 'MED', floors: ['Ground', '1'] }] },
  ];

  for (const campus of campusesData) {
    await prisma.campus.create({
      data: {
        name: campus.name,
        buildings: { create: campus.buildings.map(b => ({ name: b.name, code: b.code, floors: { create: b.floors.map(f => ({ level: f })) } })) }
      }
    });
  }

  const allFloors = await prisma.floor.findMany({ include: { building: true } });
  const getFloor = (bCode: string, level: string) => allFloors.find(f => f.building.code === bCode && f.level === level)!.id;

  const roomData: any[] = [];
  const standardBldgs = ['ENG', 'BUS', 'MED', 'SCI'];
  
  for (const bldg of standardBldgs) {
    // Standard Classrooms (Exactly 30 places)
    for (let i = 101; i <= 115; i++) roomData.push({ name: `${bldg}-${i} (Classroom)`, capacity: 30, roomType: RoomType.CLASSROOM, equipment: [Equipment.WHITEBOARD], floorId: getFloor(bldg, 'Ground') });
    
    // Computer Labs (Exactly 30 places)
    for (let i = 1; i <= 8; i++) roomData.push({ name: `${bldg} PC Lab ${i}`, capacity: 30, roomType: RoomType.COMPUTER_LAB, equipment: [Equipment.COMPUTERS], floorId: getFloor(bldg, '1') });
    
    // 🚨 BI-WEEKLY SCIENCE LABS: Physical seats = 15. System capacity = 30 to allow the alternating 30-person cohort to book the single time slot!
    if (bldg === 'SCI' || bldg === 'MED') {
      for (let i = 1; i <= 10; i++) {
        roomData.push({ name: `Chemistry Lab ${i} (15 Seats BiWeekly)`, capacity: 30, roomType: RoomType.CHEMISTRY_LAB, equipment: [Equipment.CHEMISTRY_HOOD], floorId: getFloor(bldg, 'Ground') });
        roomData.push({ name: `Physics Lab ${i} (15 Seats BiWeekly)`, capacity: 30, roomType: RoomType.CHEMISTRY_LAB, equipment: [], floorId: getFloor(bldg, '1') });
      }
    }
  }
  await prisma.room.createMany({ data: roomData });

  // 4. PROFESSORS
  console.log('👨‍🏫 Seeding 100 Polyvalent Professors...');
  const profData: any[] = [];
  for (let i = 1; i <= 100; i++) {
    profData.push({
      name: `Dr. Faculty Staff ${i}`,
      department: 'University Faculty',
      maxHoursPerWeek: 45, 
      timePreference: TimePreference.NO_PREFERENCE
    });
  }
  await prisma.professor.createMany({ data: profData });
  const allProfs = await prisma.professor.findMany();

  // 5. TERMS
  console.log('📅 Seeding Semester 1 and Semester 2...');
  const fall26 = await prisma.term.create({ data: { name: 'Fall 2026', type: TermType.SEMESTER_1, startDate: new Date('2026-09-01T00:00:00Z'), endDate: new Date('2026-12-20T00:00:00Z') } });
  const spring27 = await prisma.term.create({ data: { name: 'Spring 2027', type: TermType.SEMESTER_2, startDate: new Date('2027-01-10T00:00:00Z'), endDate: new Date('2027-05-15T00:00:00Z') } });

  // 6. COHORTS (Strictly 30 Students per group to match room sizes!)
  console.log('👥 Seeding Strict 30-Student Cohorts (5 Groups per major)...');
  const cohortPrefixes = ['SWE', 'CS', 'BUS', 'MED', 'ENG'];
  const groups = ['Grp 1', 'Grp 2', 'Grp 3', 'Grp 4', 'Grp 5'];
  const cohortData: any[] = [];
  
  for (const prefix of cohortPrefixes) {
    for (const group of groups) {
      // 🚨 EXACTLY 30 STUDENTS
      cohortData.push({ name: `${prefix} - Y1 ${group}`, hc: 30 });
      cohortData.push({ name: `${prefix} - Y2 ${group}`, hc: 30 });
    }
  }

  const createdCohorts: Record<string, any> = {};
  for (const c of cohortData) {
    createdCohorts[c.name] = await prisma.cohort.create({ data: { name: c.name, headcount: c.hc, currentSemester: TermType.SEMESTER_1 } });
  }

  // 7. COURSES (The Universal Catalog including Physics/Chem Labs)
  console.log('📘 Seeding Course Catalog with specific Science Lab requirements...');
  
  const standardCourses = [
    'Calculus I', 'Algebra', 'Intro to Programming', 'Digital Logic', 'Communication', 
    'Calculus II', 'Discrete Math', 'Data Structures', 'Web Dev', 'Ethics',              
    'Databases', 'OS', 'Computer Architecture', 'Microecon', 'Marketing', 'Statistics',                
    'Networks', 'Security', 'Agile Project Mgmt', 'Macroecon', 'HR Mgmt', 'Finance'                    
  ];

  const scienceCourses = [
    'Physics I', 'Chemistry I', 'Physics II', 'Chemistry II'
  ];

  const createdCourses: Record<string, any> = {};
  
  // Standard Courses (Classroom + PC Lab)
  for (let i = 0; i < standardCourses.length; i++) {
    const courseName = standardCourses[i];
    createdCourses[courseName] = await prisma.course.create({
      data: {
        code: `CRS${100 + i}`, title: courseName, totalHours: 45, offeredInTerms: [TermType.SEMESTER_1, TermType.SEMESTER_2],
        componentsTemplate: {
          create: [
            { type: ComponentType.LECTURE, requiresRoomType: RoomType.CLASSROOM, totalComponentHours: 30, hoursPerSession: 1.5, requiredEquipment: [Equipment.WHITEBOARD] },
            { type: ComponentType.TD, requiresRoomType: RoomType.COMPUTER_LAB, totalComponentHours: 15, hoursPerSession: 1.5, requiredEquipment: [Equipment.COMPUTERS] }
          ]
        }
      },
      include: { componentsTemplate: true }
    });
  }

  // Science Courses (Classroom + Bi-Weekly Science Lab)
  for (let i = 0; i < scienceCourses.length; i++) {
    const courseName = scienceCourses[i];
    createdCourses[courseName] = await prisma.course.create({
      data: {
        code: `SCI${100 + i}`, title: courseName, totalHours: 45, offeredInTerms: [TermType.SEMESTER_1, TermType.SEMESTER_2],
        componentsTemplate: {
          create: [
            { type: ComponentType.LECTURE, requiresRoomType: RoomType.CLASSROOM, totalComponentHours: 30, hoursPerSession: 1.5, requiredEquipment: [Equipment.WHITEBOARD] },
            // 🚨 THIS COMPONENT targets the specific Science Labs
            { type: ComponentType.TP, requiresRoomType: RoomType.CHEMISTRY_LAB, totalComponentHours: 15, hoursPerSession: 1.5, requiredEquipment: [] }
          ]
        }
      },
      include: { componentsTemplate: true }
    });
  }

  // 8. FIXED CURRICULUM + DYNAMIC PROFESSOR ALGORITHM
  console.log('⚙️ Assigning Fixed Curriculums: 12 Courses/Year (6 per Semester)...');
  
  // 🚨 FIXED: Types updated to 'string' to handle Prisma UUIDs/CUIDs properly
  const profHoursTracker: Record<string, Record<string, number>> = { [fall26.id]: {}, [spring27.id]: {} };
  const courseProfGroupCount: Record<string, Record<string, Record<string, number>>> = { [fall26.id]: {}, [spring27.id]: {} };
  
  allProfs.forEach(p => {
    profHoursTracker[fall26.id][p.id] = 0;
    profHoursTracker[spring27.id][p.id] = 0;
  });

  // 🚨 FIXED: Function signature accepts 'string' types
  function assignProfessorToGroup(termId: string, courseId: string, requiredHours: number): string {
    if (!courseProfGroupCount[termId][courseId]) courseProfGroupCount[termId][courseId] = {};
    
    // Try to find a teacher already teaching this course this term (but < 4 groups)
    const existingProfIds = Object.keys(courseProfGroupCount[termId][courseId]);
    for (const pId of existingProfIds) {
      if (courseProfGroupCount[termId][courseId][pId] < 4 && (profHoursTracker[termId][pId] + requiredHours) <= 45) {
        courseProfGroupCount[termId][courseId][pId]++;
        profHoursTracker[termId][pId] += requiredHours;
        return pId;
      }
    }

    // Otherwise, find a NEW Polyvalent Teacher for this term
    const availableProfs = allProfs.filter(p => (profHoursTracker[termId][p.id] + requiredHours) <= 45);
    if (availableProfs.length === 0) throw new Error(`Ran out of Professor hours in Term ${termId}!`);

    const randomProf = availableProfs[Math.floor(Math.random() * availableProfs.length)];
    courseProfGroupCount[termId][courseId][randomProf.id] = 1;
    profHoursTracker[termId][randomProf.id] += requiredHours;
    
    return randomProf.id;
  }

  // Injecting the Science Labs into the exact curriculum blocks
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
                  type: t.type, durationMinutes: t.hoursPerSession * 60, requiresRoomType: t.requiresRoomType, requiredEquipment: t.requiredEquipment, isRecurringWeekly: true,
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
                  type: t.type, durationMinutes: t.hoursPerSession * 60, requiresRoomType: t.requiresRoomType, requiredEquipment: t.requiredEquipment, isRecurringWeekly: true,
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
  console.log('🧑‍🎓 Generating Individual Students (Exactly 30 per cohort)...');
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
  console.log('📝 Enrolling students in their full curriculum...');
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

  console.log('✅✅✅ Strict Curriculum, 30-Student Classes, and Bi-Weekly Lab Logic Applied!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });