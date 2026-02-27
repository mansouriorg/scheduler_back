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
  console.log('🌱 Starting 4X MEGA database seeding with REALISTIC courses & EXPANDED data...');

  // 1. CLEANUP
  console.log('🧹 Cleaning existing data...');
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
  console.log('🏢 Seeding 5 Campuses & 12 Buildings...');
  const campusesData = [
    {
      name: 'North Tech Campus',
      buildings: [
        { name: 'Engineering Block', code: 'ENG', floors: ['Ground', '1', '2', '3'] },
        { name: 'Computer Science Hub', code: 'CSH', floors: ['Ground', '1', '2'] },
        { name: 'Applied Sciences', code: 'SCI', floors: ['Ground', '1'] }
      ]
    },
    {
      name: 'South Downtown Campus',
      buildings: [
        { name: 'Business Tower', code: 'BUS', floors: ['Ground', '1', '2', '3'] },
        { name: 'Law Center', code: 'LAW', floors: ['Ground', '1', '2'] }
      ]
    },
    {
      name: 'West Medical Campus',
      buildings: [
        { name: 'Medical Sciences', code: 'MED', floors: ['Ground', '1', '2'] },
        { name: 'Nursing Wing', code: 'NUR', floors: ['Ground', '1'] },
        { name: 'Pharmacy Block', code: 'PHA', floors: ['Ground', '1'] }
      ]
    },
    {
      name: 'East Humanities Campus',
      buildings: [
        { name: 'Arts & Design', code: 'ART', floors: ['Ground', '1', '2'] },
        { name: 'Literature & History', code: 'LIT', floors: ['Ground', '1'] },
        { name: 'Education Dept', code: 'EDU', floors: ['Ground', '1'] },
        { name: 'Architecture Studio', code: 'ARC', floors: ['Ground', '1'] }
      ]
    },
    {
      name: 'Central Research Hub',
      buildings: [
        { name: 'Advanced Research Facility', code: 'RES', floors: ['Ground', '1', '2', '3'] },
        { name: 'Innovation Lab', code: 'INV', floors: ['Ground'] }
      ]
    }
  ];

  for (const campus of campusesData) {
    await prisma.campus.create({
      data: {
        name: campus.name,
        buildings: {
          create: campus.buildings.map(b => ({
            name: b.name,
            code: b.code,
            floors: { create: b.floors.map(f => ({ level: f })) }
          }))
        }
      }
    });
  }

  const allFloors = await prisma.floor.findMany({ include: { building: true } });
  const getFloor = (bCode: string, level: string) => allFloors.find(f => f.building.code === bCode && f.level === level)!.id;

  console.log('🚪 Seeding 200+ Rooms...');
  const roomData: any[] = [];
  
  const amphiBldgs = ['ENG', 'BUS', 'MED', 'ART', 'LAW', 'SCI', 'EDU', 'PHA', 'ARC'];
  let amphiCount = 1;
  for (const bldg of amphiBldgs) {
    for (let i = 0; i < 6; i++) { 
      roomData.push({ name: `Amphi ${amphiCount++} (${bldg})`, capacity: 250 + (Math.floor(Math.random() * 100)), roomType: RoomType.AMPHI, equipment: [Equipment.PROJECTOR, Equipment.SMARTBOARD], floorId: getFloor(bldg, 'Ground') });
    }
  }

  // 🚨 ALL ROOMS UPGRADED TO 100 CAPACITY TO FIT MAX COHORTS
  const classBldgs = ['ENG', 'CSH', 'BUS', 'LAW', 'MED', 'NUR', 'ART', 'LIT', 'EDU', 'RES', 'PHA', 'ARC'];
  for (const bldg of classBldgs) {
    for (let i = 101; i <= 120; i++) { // Increased to 20 classrooms per building to handle expanded data
      roomData.push({ name: `${bldg}-${i}`, capacity: 100, roomType: RoomType.CLASSROOM, equipment: [Equipment.WHITEBOARD, Equipment.PROJECTOR], floorId: getFloor(bldg, '1') });
    }
  }

  const labBldgs = ['CSH', 'ENG', 'BUS', 'RES', 'ARC'];
  for (const bldg of labBldgs) {
    for (let i = 1; i <= 10; i++) { 
      roomData.push({ name: `PC Lab ${bldg}-${i}`, capacity: 100, roomType: RoomType.COMPUTER_LAB, equipment: [Equipment.COMPUTERS, Equipment.PROJECTOR], floorId: getFloor(bldg, '1') });
      roomData.push({ name: `Mac Lab ${bldg}-${i}`, capacity: 100, roomType: RoomType.COMPUTER_LAB, equipment: [Equipment.MAC_COMPUTERS, Equipment.PROJECTOR], floorId: getFloor(bldg, 'Ground') });
    }
  }

  for (let i = 1; i <= 15; i++) roomData.push({ name: `Chem Lab ${i}`, capacity: 100, roomType: RoomType.CHEMISTRY_LAB, equipment: [Equipment.CHEMISTRY_HOOD], floorId: getFloor('SCI', '1') });
  for (let i = 1; i <= 15; i++) roomData.push({ name: `Bio Lab ${i}`, capacity: 100, roomType: RoomType.CHEMISTRY_LAB, equipment: [], floorId: getFloor('MED', '1') });
  for (let i = 1; i <= 15; i++) roomData.push({ name: `Pharma Lab ${i}`, capacity: 100, roomType: RoomType.CHEMISTRY_LAB, equipment: [Equipment.CHEMISTRY_HOOD], floorId: getFloor('PHA', '1') });
  for (let i = 1; i <= 15; i++) roomData.push({ name: `Art Studio ${i}`, capacity: 100, roomType: RoomType.WORKSHOP, equipment: [Equipment.WHITEBOARD], floorId: getFloor('ART', '1') });
  for (let i = 1; i <= 15; i++) roomData.push({ name: `Design Workshop ${i}`, capacity: 100, roomType: RoomType.WORKSHOP, equipment: [Equipment.WHITEBOARD, Equipment.PROJECTOR], floorId: getFloor('ARC', '1') });

  await prisma.room.createMany({ data: roomData });

  // 4. PROFESSORS (Increased from 120 to 150)
  console.log('👨‍🏫 Seeding 150 Professors...');
  const profData: any[] = [];
  const departments = ['Computer Science', 'Mathematics', 'Physics', 'Software Engineering', 'Business', 'Law', 'Fine Arts', 'Medicine', 'Nursing', 'Literature', 'Education', 'History', 'Pharmacy', 'Architecture'];
  
  for (let i = 1; i <= 150; i++) {
    profData.push({
      name: i % 2 === 0 ? `Prof. Faculty Member ${i}` : `Dr. Academic Staff ${i}`,
      department: departments[i % departments.length],
      maxHoursPerWeek: Math.floor(Math.random() * 10) + 12, 
      timePreference: [TimePreference.MORNING, TimePreference.AFTERNOON, TimePreference.EVENING, TimePreference.NO_PREFERENCE][Math.floor(Math.random() * 4)]
    });
  }
  await prisma.professor.createMany({ data: profData });

  // 5. TERMS
  console.log('📅 Seeding 4 Academic Terms...');
  const fall26 = await prisma.term.create({ data: { name: 'Fall 2026', type: TermType.SEMESTER_1, startDate: new Date('2026-09-01T00:00:00Z'), endDate: new Date('2026-12-20T00:00:00Z') } });
  await prisma.term.create({ data: { name: 'Spring 2027', type: TermType.SEMESTER_2, startDate: new Date('2027-01-10T00:00:00Z'), endDate: new Date('2027-05-15T00:00:00Z') } });

  // 6. COHORTS (Added ARC and PHA)
  console.log('👥 Seeding 100+ Student Cohorts...');
  const cohortPrefixes = ['SWE', 'CS', 'IT', 'BUS', 'FIN', 'LAW', 'MED', 'NUR', 'ART', 'LIT', 'EDU', 'HIS', 'MCH', 'EE', 'PSY', 'SOC', 'ARC', 'PHA'];
  const cohortData: any[] = [];
  
  for (const prefix of cohortPrefixes) {
    cohortData.push({ name: `${prefix} - Y1 Grp A`, hc: 40 });
    cohortData.push({ name: `${prefix} - Y1 Grp B`, hc: 40 });
    cohortData.push({ name: `${prefix} - Y1 Grp C`, hc: 35 });
    cohortData.push({ name: `${prefix} - Y2 Grp A`, hc: 65 });
    cohortData.push({ name: `${prefix} - Y2 Grp B`, hc: 60 });
    cohortData.push({ name: `${prefix} - Y3`, hc: 80 });
    cohortData.push({ name: `${prefix} - Y4`, hc: 75 });
  }

  const createdCohorts: any = {};
  for (const c of cohortData) {
    createdCohorts[c.name] = await prisma.cohort.create({ data: { name: c.name, headcount: c.hc, currentSemester: TermType.SEMESTER_1 } });
  }

  // 7. COURSES (REALISTIC 130+ Course Blueprints)
  console.log('📘 Seeding Realistic Course Blueprints...');
  const courseTemplates: any[] = [
    // Core Base Courses
    { code: 'CS101', title: 'Intro to Programming', hrs: 60, comps: [{ t: ComponentType.LECTURE, rt: RoomType.AMPHI, h: 30, s: 1.5, eq: [Equipment.PROJECTOR] }, { t: ComponentType.TP, rt: RoomType.COMPUTER_LAB, h: 30, s: 1.5, eq: [Equipment.COMPUTERS] }] },
    { code: 'MTH101', title: 'Calculus I', hrs: 60, comps: [{ t: ComponentType.LECTURE, rt: RoomType.AMPHI, h: 30, s: 1.5, eq: [] }, { t: ComponentType.TD, rt: RoomType.CLASSROOM, h: 30, s: 1.5, eq: [Equipment.WHITEBOARD] }] },
  ];

  const realisticCourses = [
    { code: 'SWE201', title: 'Web Technologies' }, { code: 'SWE202', title: 'Mobile App Development' }, { code: 'SWE301', title: 'Software Testing & QA' }, { code: 'SWE302', title: 'UI/UX Engineering' }, { code: 'SWE401', title: 'DevOps & CI/CD' }, { code: 'SWE402', title: 'Agile Project Management' },
    { code: 'CS203', title: 'Computer Architecture' }, { code: 'CS204', title: 'Operating Systems' }, { code: 'CS301', title: 'Database Management Systems' }, { code: 'CS302', title: 'Computer Networks' }, { code: 'CS303', title: 'Cryptography & Security' }, { code: 'CS401', title: 'Artificial Intelligence' }, { code: 'CS402', title: 'Machine Learning' }, { code: 'CS403', title: 'Natural Language Processing' }, { code: 'CS404', title: 'Computer Graphics' }, { code: 'CS405', title: 'Distributed Systems' }, { code: 'CS406', title: 'Blockchain Fundamentals' }, { code: 'CS407', title: 'Quantum Computing' },
    { code: 'MTH201', title: 'Discrete Mathematics' }, { code: 'MTH202', title: 'Differential Equations' }, { code: 'MTH301', title: 'Probability & Statistics' }, { code: 'MTH302', title: 'Numerical Analysis' }, { code: 'MTH401', title: 'Graph Theory' }, { code: 'MTH402', title: 'Operations Research' },
    { code: 'IT201', title: 'System Administration' }, { code: 'IT202', title: 'IT Service Management' }, { code: 'IT301', title: 'Network Security' }, { code: 'IT302', title: 'Cloud Computing Services' }, { code: 'IT401', title: 'Ethical Hacking' }, { code: 'IT402', title: 'Digital Forensics' },
    { code: 'BUS201', title: 'Microeconomics' }, { code: 'BUS202', title: 'Macroeconomics' }, { code: 'BUS301', title: 'Organizational Behavior' }, { code: 'BUS302', title: 'Human Resource Management' }, { code: 'BUS401', title: 'Strategic Management' }, { code: 'BUS402', title: 'International Business' }, { code: 'BUS403', title: 'Supply Chain Management' }, { code: 'BUS404', title: 'Business Ethics' },
    { code: 'FIN301', title: 'Investment Analysis' }, { code: 'FIN302', title: 'Financial Markets' }, { code: 'FIN401', title: 'International Finance' }, { code: 'FIN402', title: 'Risk Management' },
    { code: 'MKT201', title: 'Consumer Behavior' }, { code: 'MKT302', title: 'Market Research' }, { code: 'MKT401', title: 'Brand Management' }, { code: 'MKT402', title: 'Digital Marketing' },
    { code: 'LAW201', title: 'Property Law' }, { code: 'LAW202', title: 'Tort Law' }, { code: 'LAW302', title: 'Family Law' }, { code: 'LAW303', title: 'Administrative Law' }, { code: 'LAW401', title: 'International Public Law' }, { code: 'LAW402', title: 'Human Rights Law' }, { code: 'LAW403', title: 'Intellectual Property Law' }, { code: 'LAW404', title: 'Environmental Law' }, { code: 'LAW405', title: 'Corporate Governance' }, { code: 'LAW406', title: 'Cyber Law' },
    { code: 'MED202', title: 'Physiology' }, { code: 'MED301', title: 'Pharmacology' }, { code: 'MED302', title: 'Immunology' }, { code: 'MED303', title: 'Microbiology' }, { code: 'MED401', title: 'Genetics' }, { code: 'MED402', title: 'Neuroscience' }, { code: 'MED403', title: 'Clinical Practice' }, { code: 'MED404', title: 'Pediatrics' }, { code: 'MED405', title: 'Surgery Fundamentals' }, { code: 'MED406', title: 'Psychiatry' },
    { code: 'NUR201', title: 'Adult Health Nursing' }, { code: 'NUR202', title: 'Maternal-Newborn Nursing' }, { code: 'NUR301', title: 'Pediatric Nursing' }, { code: 'NUR302', title: 'Psychiatric Nursing' }, { code: 'NUR401', title: 'Community Health Nursing' }, { code: 'NUR402', title: 'Nursing Leadership' },
    { code: 'ART202', title: 'Modern Art' }, { code: 'ART301', title: 'Renaissance Art' }, { code: 'ART302', title: 'Art Criticism' }, { code: 'ART401', title: 'Sculpture & 3D Design' },
    { code: 'LIT201', title: 'American Literature' }, { code: 'LIT202', title: 'British Literature' }, { code: 'LIT301', title: 'Postcolonial Literature' }, { code: 'LIT302', title: 'Creative Writing Workshop' }, { code: 'LIT401', title: 'Shakespearean Drama' }, { code: 'LIT402', title: 'Contemporary Poetry' },
    { code: 'HIS201', title: 'Ancient Civilizations' }, { code: 'HIS202', title: 'Medieval Europe' }, { code: 'HIS301', title: 'The World Wars' }, { code: 'HIS302', title: 'Cold War Era' }, { code: 'HIS401', title: 'Modern Middle East' },
    { code: 'EDU201', title: 'Child Development' }, { code: 'EDU202', title: 'Educational Psychology' }, { code: 'EDU301', title: 'Classroom Management' }, { code: 'EDU302', title: 'Special Education Needs' }, { code: 'EDU401', title: 'Curriculum Design' },
    { code: 'PSY201', title: 'Cognitive Psychology' }, { code: 'PSY202', title: 'Abnormal Psychology' }, { code: 'PSY301', title: 'Social Psychology' }, { code: 'PSY302', title: 'Developmental Psychology' }, { code: 'PSY401', title: 'Clinical Psychology' },
    { code: 'SOC201', title: 'Sociological Theory' }, { code: 'SOC202', title: 'Social Inequality' }, { code: 'SOC301', title: 'Criminology' }, { code: 'SOC302', title: 'Urban Sociology' }, { code: 'SOC401', title: 'Globalization & Society' },
    { code: 'EE201', title: 'Circuit Analysis' }, { code: 'EE202', title: 'Digital Logic Design' }, { code: 'EE301', title: 'Signals and Systems' }, { code: 'EE302', title: 'Electromagnetics' }, { code: 'EE401', title: 'Control Systems' }, { code: 'EE402', title: 'Power Electronics' },
    { code: 'MCH201', title: 'Statics & Dynamics' }, { code: 'MCH202', title: 'Thermodynamics' }, { code: 'MCH301', title: 'Fluid Mechanics' }, { code: 'MCH302', title: 'Materials Science' }, { code: 'MCH401', title: 'Robotics & Automation' }, { code: 'MCH402', title: 'Heat Transfer' },
    // NEW ARCHITECTURE COURSES
    { code: 'ARC201', title: 'Architectural Design Fundamentals' }, { code: 'ARC202', title: 'History of Architecture' }, { code: 'ARC301', title: 'Urban Planning' }, { code: 'ARC302', title: 'Sustainable Building Design' }, { code: 'ARC401', title: 'Building Structures' }, { code: 'ARC402', title: 'Landscape Architecture' },
    // NEW PHARMACY COURSES
    { code: 'PHA201', title: 'Pharmaceutics I' }, { code: 'PHA202', title: 'Organic Chemistry for Pharmacy' }, { code: 'PHA301', title: 'Medicinal Chemistry' }, { code: 'PHA302', title: 'Pharmacokinetics' }, { code: 'PHA401', title: 'Clinical Pharmacy' }, { code: 'PHA402', title: 'Toxicology' },
  ];

  for (const c of realisticCourses) {
    courseTemplates.push({
      code: c.code,
      title: c.title,
      hrs: 45,
      comps: [
        { t: ComponentType.LECTURE, rt: RoomType.AMPHI, h: 30, s: 1.5, eq: [Equipment.PROJECTOR] },
        { t: ComponentType.TD, rt: RoomType.CLASSROOM, h: 15, s: 1.5, eq: [Equipment.WHITEBOARD] }
      ]
    });
  }

  const createdCourses: any = {};
  for (const c of courseTemplates) {
    createdCourses[c.code] = await prisma.course.create({
      data: {
        code: c.code, title: c.title, totalHours: c.hrs, offeredInTerms: [TermType.SEMESTER_1, TermType.SEMESTER_2],
        componentsTemplate: {
          create: c.comps.map((comp: any) => ({
            type: comp.t, requiresRoomType: comp.rt, totalComponentHours: comp.h, hoursPerSession: comp.s, requiredEquipment: comp.eq
          }))
        }
      },
      include: { componentsTemplate: true }
    });
  }

  // 8. COURSE OFFERINGS (Intelligent assignments based on Major)
  console.log('⚙️ Generating Domain-Specific Course Offerings...');
  
  const assignCourse = async (courseCode: string, cohortName: string) => {
    const course = createdCourses[courseCode];
    const cohort = createdCohorts[cohortName];
    if (!course || !cohort) return;

    await prisma.courseOffering.create({
      data: {
        termId: fall26.id, courseId: course.id, cohortId: cohort.id,
        classes: {
          create: course.componentsTemplate.map((t: any) => ({
            type: t.type,
            durationMinutes: t.hoursPerSession * 60,
            requiresRoomType: t.requiresRoomType,
            requiredEquipment: t.requiredEquipment,
            isRecurringWeekly: true,
          }))
        }
      }
    });
  };

  // We loop through ALL created cohorts and assign them courses based on their major!
  for (const cohortName of Object.keys(createdCohorts)) {
    // Extract the major prefix from the cohort name (e.g., "MED" from "MED - Y1 Grp A")
    const majorPrefix = cohortName.split(' - ')[0];

    // Give fundamental courses only to relevant majors
    if (['SWE', 'CS', 'IT', 'EE'].includes(majorPrefix)) {
      await assignCourse('CS101', cohortName); // Tech gets programming
      await assignCourse('MTH101', cohortName); // Tech gets math
    } else if (['BUS', 'FIN', 'MKT', 'ARC'].includes(majorPrefix)) {
      await assignCourse('MTH101', cohortName); // Business & Arch get math
    }

    // Now, find all courses in our realistic catalog that perfectly match this cohort's major!
    const domainSpecificCourses = realisticCourses.filter(c => c.code.startsWith(majorPrefix));
    
    // Assign up to 5 major-specific courses to this cohort
    let assignedCount = 0;
    for (const course of domainSpecificCourses) {
      if (assignedCount >= 5) break; 
      await assignCourse(course.code, cohortName);
      assignedCount++;
    }
  }

  console.log('✅✅✅ 4X MEGA Database Seeding Complete! Have fun building the Calendar!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });