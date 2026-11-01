import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CourseOfferingsService } from './course-offerings.service';

// Tests for adding, moving and deleting course offerings, and for choosing the
// teachers of their classes. The database (PrismaService) is a stand-in:
// nothing real is read or written.

// DEV-101 offered to SE - Year 1 in Fall 2026, as the service reads it.
const offering = {
  id: 'offering-1',
  termId: 'term-1',
  courseId: 'course-1',
  cohortId: 'cohort-1',
  term: { name: 'Fall 2026' },
  course: { code: 'DEV-101' },
  cohort: { name: 'SE - Year 1' },
};

const course = {
  id: 'course-1',
  code: 'DEV-101',
  componentsTemplate: [
    {
      type: 'LECTURE',
      hoursPerSession: 1.5,
      requiresRoomType: 'AMPHI',
      requiredEquipment: [],
      mustFollowType: null,
    },
    {
      type: 'TP',
      hoursPerSession: 2,
      requiresRoomType: 'COMPUTER_LAB',
      requiredEquipment: ['COMPUTERS'],
      mustFollowType: 'LECTURE',
    },
  ],
};

const ALL = { term: true, course: true, cohort: true, classes: true };

// The same offering with its classes, as assignTeachers reads it. The lecture
// is in the timetable on Monday 08:30-10:00 without a teacher; the TP is not
// in the timetable yet and is taught by Karim Haddad (prof-2).
const withClasses = {
  ...offering,
  term: {
    name: 'Fall 2026',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2027-01-31'),
  },
  classes: [
    {
      id: 'lecture-1',
      type: 'LECTURE',
      durationMinutes: 90,
      assignedProfessorId: null,
      dayOfWeek: 'MONDAY',
      startTime: '08:30',
      endTime: '10:00',
    },
    {
      id: 'tp-1',
      type: 'TP',
      durationMinutes: 120,
      assignedProfessorId: 'prof-2',
      dayOfWeek: null,
      startTime: null,
      endTime: null,
    },
  ],
};

const amal = {
  id: 'prof-1',
  name: 'Amal Ben Ali',
  maxHoursPerWeek: 12,
  unavailability: [],
};

// The term an offering moves to, and Karim Haddad (prof-2, the teacher of the
// TP above) with a maximum of 3 hours a week.
const spring2027 = {
  id: 'term-2',
  name: 'Spring 2027',
  startDate: new Date('2027-02-01'),
  endDate: new Date('2027-06-30'),
};
const karim = {
  id: 'prof-2',
  name: 'Karim Haddad',
  maxHoursPerWeek: 3,
  unavailability: [],
};

// Another class of Karim's, 90 minutes, in an offering of Spring 2027.
const karimElsewhere = {
  id: 'other-td',
  type: 'TD',
  durationMinutes: 90,
  assignedProfessorId: 'prof-2',
  dayOfWeek: null,
  startTime: null,
  endTime: null,
  courseOffering: {
    term: { name: 'Spring 2027' },
    course: { code: 'DB-201' },
    cohort: { name: 'SE - Year 2' },
  },
};

type PrismaStandIn = {
  course: { findUnique: jest.Mock };
  term: { findUnique: jest.Mock };
  cohort: { findUnique: jest.Mock };
  courseOffering: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  professor: { findMany: jest.Mock };
  classComponent: { findMany: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
};

describe('CourseOfferingsService', () => {
  let service: CourseOfferingsService;
  let prisma: PrismaStandIn;

  const refusal = (promise: Promise<unknown>) =>
    promise.catch((caught: unknown) => caught);

  beforeEach(async () => {
    prisma = {
      course: { findUnique: jest.fn().mockResolvedValue(course) },
      term: { findUnique: jest.fn().mockResolvedValue({ id: 'term-2' }) },
      cohort: { findUnique: jest.fn().mockResolvedValue({ id: 'cohort-2' }) },
      courseOffering: {
        findUnique: jest.fn().mockResolvedValue(offering),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(offering),
        update: jest.fn().mockResolvedValue(offering),
        delete: jest.fn().mockResolvedValue(offering),
      },
      professor: { findMany: jest.fn().mockResolvedValue([amal]) },
      classComponent: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockReturnValue('one update'),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseOfferingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CourseOfferingsService>(CourseOfferingsService);
  });

  describe('create', () => {
    it('makes a class for each part of the course', async () => {
      await service.create({
        termId: 'term-1',
        courseId: 'course-1',
        cohortId: 'cohort-1',
      });

      expect(prisma.courseOffering.create).toHaveBeenCalledWith({
        data: {
          termId: 'term-1',
          courseId: 'course-1',
          cohortId: 'cohort-1',
          classes: {
            create: [
              {
                type: 'LECTURE',
                durationMinutes: 90,
                requiresRoomType: 'AMPHI',
                requiredEquipment: [],
                mustFollowType: null,
                isRecurringWeekly: true,
              },
              {
                type: 'TP',
                durationMinutes: 120,
                requiresRoomType: 'COMPUTER_LAB',
                requiredEquipment: ['COMPUTERS'],
                mustFollowType: 'LECTURE',
                isRecurringWeekly: true,
              },
            ],
          },
        },
        include: { classes: true },
      });
    });

    it('refuses a course that the cohort already has in that term', async () => {
      prisma.courseOffering.findFirst.mockResolvedValue(offering);

      const error = await refusal(
        service.create({
          termId: 'term-1',
          courseId: 'course-1',
          cohortId: 'cohort-1',
        }),
      );

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'DEV-101 for SE - Year 1 in Fall 2026 already exists, so the course cannot be offered to that cohort in that term again.',
      );
      expect(prisma.courseOffering.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('lists the offerings with the room and place of each class', async () => {
      await service.findAll();

      expect(prisma.courseOffering.findMany).toHaveBeenCalledWith({
        include: {
          term: true,
          course: true,
          cohort: true,
          classes: {
            include: {
              room: {
                select: {
                  name: true,
                  floor: {
                    select: {
                      level: true,
                      building: { select: { name: true, code: true } },
                    },
                  },
                },
              },
            },
            orderBy: [{ type: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy: { term: { startDate: 'desc' } },
      });
    });
  });

  describe('update', () => {
    it('moves the offering to another cohort and takes its classes out of the timetable', async () => {
      await service.update('offering-1', { cohortId: 'cohort-2' });

      expect(prisma.courseOffering.findFirst).toHaveBeenCalledWith({
        where: {
          courseId: 'course-1',
          termId: 'term-1',
          cohortId: 'cohort-2',
          id: { not: 'offering-1' },
        },
        include: {
          term: { select: { name: true } },
          course: { select: { code: true } },
          cohort: { select: { name: true } },
        },
      });
      expect(prisma.courseOffering.update).toHaveBeenCalledWith({
        where: { id: 'offering-1' },
        data: {
          termId: 'term-1',
          cohortId: 'cohort-2',
          classes: {
            updateMany: {
              where: {},
              data: {
                assignedRoomId: null,
                dayOfWeek: null,
                startTime: null,
                endTime: null,
              },
            },
          },
        },
        include: ALL,
      });
    });

    it('leaves the timetable alone when the term and cohort stay the same', async () => {
      await service.update('offering-1', {
        termId: 'term-1',
        courseId: 'course-1',
        cohortId: 'cohort-1',
      });

      expect(prisma.courseOffering.update).toHaveBeenCalledWith({
        where: { id: 'offering-1' },
        data: { termId: 'term-1', cohortId: 'cohort-1' },
        include: ALL,
      });
    });

    it('refuses another course', async () => {
      const error = await refusal(
        service.update('offering-1', { courseId: 'course-2' }),
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        'The course of an offering cannot change: its classes were made from DEV-101. Delete this offering and add one for the other course.',
      );
      expect(prisma.courseOffering.update).not.toHaveBeenCalled();
    });

    it('refuses a move onto an offering that already exists', async () => {
      prisma.courseOffering.findFirst.mockResolvedValue({
        ...offering,
        id: 'offering-2',
        term: { name: 'Spring 2027' },
      });

      const error = await refusal(
        service.update('offering-1', { termId: 'term-2' }),
      );

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'DEV-101 for SE - Year 1 in Spring 2027 already exists, so the course cannot be offered to that cohort in that term again.',
      );
      expect(prisma.courseOffering.update).not.toHaveBeenCalled();
    });

    it('refuses, and moves nothing, a term where a teacher would teach too many hours a week', async () => {
      prisma.term.findUnique.mockResolvedValue(spring2027);
      prisma.classComponent.findMany
        .mockResolvedValueOnce([withClasses.classes[1]])
        .mockResolvedValueOnce([karimElsewhere]);
      prisma.professor.findMany.mockResolvedValue([karim]);

      const error = await refusal(
        service.update('offering-1', { termId: 'term-2' }),
      );

      expect(prisma.classComponent.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          courseOfferingId: 'offering-1',
          assignedProfessorId: { not: null },
        },
      });
      expect(prisma.classComponent.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          assignedProfessorId: 'prof-2',
          courseOfferingId: { not: 'offering-1' },
          courseOffering: {
            term: {
              startDate: { lte: spring2027.endDate },
              endDate: { gte: spring2027.startDate },
            },
          },
        },
        include: {
          courseOffering: {
            include: {
              term: { select: { name: true } },
              course: { select: { code: true } },
              cohort: { select: { name: true } },
            },
          },
        },
      });
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Karim Haddad can teach at most 3 hours a week, but would teach 3.5 hours a week in Spring 2027 with this class. Choose another teacher, or raise the maximum hours on the Teachers page.',
      );
      expect(prisma.courseOffering.update).not.toHaveBeenCalled();
    });

    it('moves to another term when its teachers keep within their hours', async () => {
      prisma.term.findUnique.mockResolvedValue(spring2027);
      prisma.classComponent.findMany
        .mockResolvedValueOnce([withClasses.classes[1]])
        .mockResolvedValueOnce([karimElsewhere]);
      prisma.professor.findMany.mockResolvedValue([
        { ...karim, maxHoursPerWeek: 4 },
      ]);

      await service.update('offering-1', { termId: 'term-2' });

      expect(prisma.courseOffering.update).toHaveBeenCalledTimes(1);
    });

    it('does not count the hours when only the cohort changes', async () => {
      await service.update('offering-1', { cohortId: 'cohort-2' });

      expect(prisma.classComponent.findMany).not.toHaveBeenCalled();
      expect(prisma.courseOffering.update).toHaveBeenCalledTimes(1);
    });

    it('answers 404 for a term that does not exist any more', async () => {
      prisma.term.findUnique.mockResolvedValue(null);

      const error = await refusal(
        service.update('offering-1', { termId: 'gone' }),
      );

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).message).toBe(
        'This term does not exist any more. Reload the page to see the current list.',
      );
      expect(prisma.courseOffering.update).not.toHaveBeenCalled();
    });

    it('answers 404 for an offering that does not exist', async () => {
      prisma.courseOffering.findUnique.mockResolvedValue(null);

      await expect(
        service.update('gone', { cohortId: 'cohort-2' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.courseOffering.update).not.toHaveBeenCalled();
    });
  });

  describe('assignTeachers', () => {
    beforeEach(() => {
      prisma.courseOffering.findUnique.mockResolvedValue(withClasses);
    });

    it('gives a class its teacher and keeps its place in the timetable', async () => {
      const result = await service.assignTeachers('offering-1', {
        classes: [{ classId: 'lecture-1', professorId: 'prof-1' }],
      });

      expect(result).toEqual({ changed: 1 });
      expect(prisma.professor.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['prof-1'] } },
        include: { unavailability: true },
      });
      // Her classes of other offerings in terms that share days with Fall 2026.
      expect(prisma.classComponent.findMany).toHaveBeenCalledWith({
        where: {
          assignedProfessorId: 'prof-1',
          courseOfferingId: { not: 'offering-1' },
          courseOffering: {
            term: {
              startDate: { lte: new Date('2027-01-31') },
              endDate: { gte: new Date('2026-09-01') },
            },
          },
        },
        include: {
          courseOffering: {
            include: {
              term: { select: { name: true } },
              course: { select: { code: true } },
              cohort: { select: { name: true } },
            },
          },
        },
      });
      expect(prisma.classComponent.update).toHaveBeenCalledTimes(1);
      expect(prisma.classComponent.update).toHaveBeenCalledWith({
        where: { id: 'lecture-1' },
        data: { assignedProfessorId: 'prof-1' },
      });
      expect(prisma.$transaction).toHaveBeenCalledWith(['one update']);
    });

    it('refuses, and says why, a teacher who teaches another class at that time', async () => {
      prisma.classComponent.findMany.mockResolvedValue([
        {
          id: 'td-9',
          type: 'TD',
          durationMinutes: 120,
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '11:00',
          courseOffering: {
            term: { name: 'Fall 2026' },
            course: { code: 'DB-201' },
            cohort: { name: 'SE - Year 2' },
          },
        },
      ]);

      const error = await refusal(
        service.assignTeachers('offering-1', {
          classes: [{ classId: 'lecture-1', professorId: 'prof-1' }],
        }),
      );

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Amal Ben Ali cannot teach DEV-101 LECTURE for SE - Year 1 on Monday from 08:30 to 10:00, because at that time Amal Ben Ali teaches DB-201 TD for SE - Year 2 (09:00 to 11:00). Choose another teacher, or clear the timetable and generate it again, so that the classes get times that suit their teachers.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a teacher who would teach more hours than their maximum, and saves nothing', async () => {
      prisma.professor.findMany.mockResolvedValue([
        { ...amal, maxHoursPerWeek: 3 },
      ]);

      const error = await refusal(
        service.assignTeachers('offering-1', {
          classes: [
            { classId: 'lecture-1', professorId: 'prof-1' },
            { classId: 'tp-1', professorId: 'prof-1' },
          ],
        }),
      );

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Amal Ben Ali can teach at most 3 hours a week, but would teach 3.5 hours a week in Fall 2026 with these classes. Choose another teacher, or raise the maximum hours on the Teachers page.',
      );
      expect(prisma.classComponent.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('takes a teacher off a class without any check', async () => {
      const result = await service.assignTeachers('offering-1', {
        classes: [{ classId: 'tp-1', professorId: null }],
      });

      expect(result).toEqual({ changed: 1 });
      expect(prisma.professor.findMany).not.toHaveBeenCalled();
      expect(prisma.classComponent.update).toHaveBeenCalledWith({
        where: { id: 'tp-1' },
        data: { assignedProfessorId: null },
      });
    });

    it('saves nothing when every class keeps its teacher', async () => {
      const result = await service.assignTeachers('offering-1', {
        classes: [
          { classId: 'lecture-1', professorId: null },
          { classId: 'tp-1', professorId: 'prof-2' },
        ],
      });

      expect(result).toEqual({ changed: 0 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('answers 404 for a class of another offering', async () => {
      const error = await refusal(
        service.assignTeachers('offering-1', {
          classes: [{ classId: 'other-class', professorId: 'prof-1' }],
        }),
      );

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).message).toBe(
        'This class does not exist any more. Reload the page to see the current list.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('answers 404 for a teacher who does not exist any more', async () => {
      prisma.professor.findMany.mockResolvedValue([]);

      const error = await refusal(
        service.assignTeachers('offering-1', {
          classes: [{ classId: 'lecture-1', professorId: 'gone' }],
        }),
      );

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).message).toBe(
        'This teacher does not exist any more. Reload the page to see the current list.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('answers 400 when a class is listed twice', async () => {
      const error = await refusal(
        service.assignTeachers('offering-1', {
          classes: [
            { classId: 'tp-1', professorId: null },
            { classId: 'tp-1', professorId: 'prof-1' },
          ],
        }),
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('answers 404 for an offering that does not exist', async () => {
      prisma.courseOffering.findUnique.mockResolvedValue(null);

      await expect(
        service.assignTeachers('gone', { classes: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an offering without enrolled students, with its classes', async () => {
      prisma.courseOffering.findUnique.mockResolvedValue({
        ...offering,
        _count: { enrollments: 0 },
      });

      await service.remove('offering-1');

      expect(prisma.courseOffering.delete).toHaveBeenCalledWith({
        where: { id: 'offering-1' },
      });
    });

    it('refuses, and says why, while students are enrolled', async () => {
      prisma.courseOffering.findUnique.mockResolvedValue({
        ...offering,
        _count: { enrollments: 3 },
      });

      const error = await refusal(service.remove('offering-1'));

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'DEV-101 for SE - Year 1 in Fall 2026 has 3 enrolled students, so it cannot be deleted: their enrollment would be lost, and the app cannot enroll students yet.',
      );
      expect(prisma.courseOffering.delete).not.toHaveBeenCalled();
    });

    it('answers 404 for an offering that does not exist', async () => {
      prisma.courseOffering.findUnique.mockResolvedValue(null);

      await expect(service.remove('gone')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.courseOffering.delete).not.toHaveBeenCalled();
    });
  });
});
