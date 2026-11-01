import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from './courses.service';

// Tests for changing and deleting courses. The database (PrismaService) is a
// stand-in: nothing real is read or written.

// One part of a course (lecture, TD or TP) with its hours.
const part = (type: 'LECTURE' | 'TD' | 'TP', hours: number) => ({
  type,
  totalComponentHours: hours,
  hoursPerSession: 1.5,
  requiresRoomType:
    type === 'TP' ? ('COMPUTER_LAB' as const) : ('AMPHI' as const),
  requiredEquipment: [],
});

// A 60-hour course: a 30-hour lecture and a 30-hour TP.
const course = {
  id: 'course-1',
  code: 'DEV-101',
  title: 'Intro to Programming',
  credits: 6,
  totalHours: 60,
  offeredInTerms: ['SEMESTER_1'],
  componentsTemplate: [part('LECTURE', 30), part('TP', 30)],
};

// An offering of the course, as the service reads it.
const offering = (term: string, cohort: string) => ({
  term: { name: term },
  cohort: { name: cohort },
});

type PrismaStandIn = {
  course: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

describe('CoursesService', () => {
  let service: CoursesService;
  let prisma: PrismaStandIn;

  const refusal = (promise: Promise<unknown>) =>
    promise.catch((caught: unknown) => caught);

  beforeEach(async () => {
    prisma = {
      course: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(course),
        delete: jest.fn().mockResolvedValue(course),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CoursesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  describe('update', () => {
    it('saves the fields that were sent and keeps the parts', async () => {
      prisma.course.findUnique.mockResolvedValue(course);

      await service.update('course-1', { title: 'Programming 1' });

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-1' },
        data: { title: 'Programming 1' },
        include: { componentsTemplate: true },
      });
    });

    it('replaces the list of parts when it is sent', async () => {
      prisma.course.findUnique.mockResolvedValue(course);
      const parts = [part('LECTURE', 15), part('TD', 30)];

      await service.update('course-1', {
        totalHours: 45,
        componentsTemplate: parts,
      });

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-1' },
        data: {
          totalHours: 45,
          componentsTemplate: { deleteMany: {}, create: parts },
        },
        include: { componentsTemplate: true },
      });
    });

    it('refuses hours that the parts do not add up to', async () => {
      prisma.course.findUnique.mockResolvedValue(course);

      const error = await refusal(
        service.update('course-1', { totalHours: 45 }),
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        'The parts add up to 60 hours, but the course has 45 hours. They must be equal.',
      );
      expect(prisma.course.update).not.toHaveBeenCalled();
    });

    it('refuses a code that another course already has', async () => {
      prisma.course.findUnique.mockImplementation(
        (args: { where: { id?: string; code?: string } }) =>
          Promise.resolve(
            args.where.id === 'course-1'
              ? course
              : { ...course, id: 'course-2', code: 'DB-201' },
          ),
      );

      const error = await refusal(
        service.update('course-1', { code: 'DB-201' }),
      );

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Another course already has the code DB-201.',
      );
      expect(prisma.course.update).not.toHaveBeenCalled();
    });

    it('answers 404, and changes nothing, for a course that does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.update('gone', { title: 'Programming 1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.course.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a course without offerings', async () => {
      prisma.course.findUnique.mockResolvedValue({ ...course, offerings: [] });

      await service.remove('course-1');

      expect(prisma.course.delete).toHaveBeenCalledWith({
        where: { id: 'course-1' },
      });
    });

    it('refuses, and says why, while the course has offerings', async () => {
      prisma.course.findUnique.mockResolvedValue({
        ...course,
        offerings: [
          offering('Fall 2026', 'SE - Year 1'),
          offering('Spring 2027', 'SE - Year 1'),
        ],
      });

      const error = await refusal(service.remove('course-1'));

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'DEV-101 has 2 course offerings (Fall 2026 for SE - Year 1, Spring 2027 for SE - Year 1), so it cannot be deleted. First delete those course offerings.',
      );
      expect(prisma.course.delete).not.toHaveBeenCalled();
    });

    it('names the one offering to delete first', async () => {
      prisma.course.findUnique.mockResolvedValue({
        ...course,
        offerings: [offering('Fall 2026', 'SE - Year 1')],
      });

      const error = await refusal(service.remove('course-1'));

      expect((error as ConflictException).message).toBe(
        'DEV-101 has 1 course offering (Fall 2026 for SE - Year 1), so it cannot be deleted. First delete that course offering.',
      );
    });

    it('answers 404 for a course that does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);

      await expect(service.remove('gone')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.course.delete).not.toHaveBeenCalled();
    });
  });
});
