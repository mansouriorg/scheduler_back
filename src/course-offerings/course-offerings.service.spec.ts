import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CourseOfferingsService } from './course-offerings.service';

// Tests for adding, moving and deleting course offerings. The database
// (PrismaService) is a stand-in: nothing real is read or written.

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

type PrismaStandIn = {
  course: { findUnique: jest.Mock };
  term: { findUnique: jest.Mock };
  cohort: { findUnique: jest.Mock };
  courseOffering: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
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
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(offering),
        update: jest.fn().mockResolvedValue(offering),
        delete: jest.fn().mockResolvedValue(offering),
      },
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
