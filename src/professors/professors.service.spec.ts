import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessorsService } from './professors.service';

// Tests for listing, changing and deleting teachers, and for their times off.
// The database (PrismaService) is a stand-in: nothing real is read or written.

const teacher = {
  id: 'prof-1',
  name: 'Dr. Amal Ben Salah',
  department: 'Computer Science',
  maxHoursPerWeek: 12,
  timePreference: 'MORNING',
  isStrictTimeRequirement: false,
};

// A class of the teacher that is in the timetable on Monday, 08:30 to 10:00.
const mondayLecture = {
  type: 'LECTURE',
  dayOfWeek: 'MONDAY',
  startTime: '08:30',
  endTime: '10:00',
  courseOffering: {
    course: { code: 'DEV-101' },
    cohort: { name: 'SE - Year 1' },
  },
};

// A class of the teacher, as the weekly hours read it: its length and its
// term (whose id, here, is its name).
const taught = (
  durationMinutes: number,
  name: string,
  startDate: string,
  endDate: string,
) => ({
  durationMinutes,
  courseOffering: {
    term: {
      id: name,
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  },
});

// What is read of the classes of a teacher for the weekly hours.
const CLASS_HOURS = {
  durationMinutes: true,
  courseOffering: {
    select: {
      term: {
        select: { id: true, name: true, startDate: true, endDate: true },
      },
    },
  },
};

// The order in which times off are read back.
const TIMES_OFF_ORDER = {
  unavailability: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
};

type PrismaStandIn = {
  professor: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  classComponent: { findMany: jest.Mock };
  professorUnavailability: { deleteMany: jest.Mock; createMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('ProfessorsService', () => {
  let service: ProfessorsService;
  let prisma: PrismaStandIn;

  beforeEach(async () => {
    prisma = {
      professor: {
        findMany: jest.fn().mockResolvedValue([teacher]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(teacher),
        delete: jest.fn().mockResolvedValue(teacher),
      },
      classComponent: { findMany: jest.fn().mockResolvedValue([]) },
      professorUnavailability: {
        deleteMany: jest.fn().mockReturnValue('old times taken away'),
        createMany: jest.fn().mockReturnValue('new times saved'),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessorsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProfessorsService>(ProfessorsService);
  });

  describe('findAll', () => {
    it('lists the teachers by name, with their times off and their hours a week in each term', async () => {
      const sami = { ...teacher, id: 'prof-2', name: 'Dr. Sami Trabelsi' };
      prisma.professor.findMany.mockResolvedValue([
        {
          ...teacher,
          unavailability: [],
          classes: [
            taught(360, 'Fall 2026', '2026-09-01', '2027-01-31'),
            taught(120, 'Winter School', '2027-01-10', '2027-02-10'),
            taught(90, 'Fall 2026', '2026-09-01', '2027-01-31'),
            taught(300, 'Summer 2027', '2027-06-01', '2027-07-31'),
          ],
        },
        { ...sami, unavailability: [], classes: [] },
      ]);

      const result = await service.findAll();

      expect(prisma.professor.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: { ...TIMES_OFF_ORDER, classes: { select: CLASS_HOURS } },
      });
      // The classes themselves are not sent: only the hours.
      expect(result).toEqual([
        {
          ...teacher,
          unavailability: [],
          weeklyHours: [
            {
              termId: 'Fall 2026',
              termName: 'Fall 2026',
              minutesPerWeek: 570,
            },
            {
              termId: 'Winter School',
              termName: 'Winter School',
              minutesPerWeek: 570,
            },
            {
              termId: 'Summer 2027',
              termName: 'Summer 2027',
              minutesPerWeek: 300,
            },
          ],
        },
        { ...sami, unavailability: [], weeklyHours: [] },
      ]);
    });
  });

  describe('setUnavailability', () => {
    const monday = (startTime: string, endTime: string) => ({
      dayOfWeek: 'MONDAY' as const,
      startTime,
      endTime,
    });

    it('replaces the times off, all together, sorted by day and time', async () => {
      const saved = { ...teacher, unavailability: [] };
      prisma.professor.findUnique
        .mockResolvedValueOnce(teacher)
        .mockResolvedValueOnce(saved);

      const result = await service.setUnavailability('prof-1', {
        times: [
          { dayOfWeek: 'FRIDAY', startTime: '14:00', endTime: '18:30' },
          monday('08:00', '12:00'),
        ],
      });

      expect(prisma.professorUnavailability.deleteMany).toHaveBeenCalledWith({
        where: { professorId: 'prof-1' },
      });
      expect(prisma.professorUnavailability.createMany).toHaveBeenCalledWith({
        data: [
          { ...monday('08:00', '12:00'), professorId: 'prof-1' },
          {
            dayOfWeek: 'FRIDAY',
            startTime: '14:00',
            endTime: '18:30',
            professorId: 'prof-1',
          },
        ],
      });
      expect(prisma.$transaction).toHaveBeenCalledWith([
        'old times taken away',
        'new times saved',
      ]);
      expect(prisma.professor.findUnique).toHaveBeenLastCalledWith({
        where: { id: 'prof-1' },
        include: TIMES_OFF_ORDER,
      });
      expect(result).toBe(saved);
    });

    it('takes every time off away with an empty list', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);

      await service.setUnavailability('prof-1', { times: [] });

      expect(prisma.professorUnavailability.createMany).toHaveBeenCalledWith({
        data: [],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('refuses, and saves nothing, a time off that ends before it starts', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);

      const error: unknown = await service
        .setUnavailability('prof-1', { times: [monday('12:00', '10:00')] })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        'A time off must end after it starts: Monday 12:00 to 10:00 does not.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses two times off that overlap on one day', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);

      const error: unknown = await service
        .setUnavailability('prof-1', {
          times: [monday('10:00', '14:00'), monday('08:00', '12:00')],
        })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        'Two times off overlap on Monday: 08:00 to 12:00 and 10:00 to 14:00. Make them one time off.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses, and says why, a time off during a class that is in the timetable', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);
      prisma.classComponent.findMany.mockResolvedValue([mondayLecture]);

      const error: unknown = await service
        .setUnavailability('prof-1', { times: [monday('08:00', '12:00')] })
        .catch((caught: unknown) => caught);

      expect(prisma.classComponent.findMany).toHaveBeenCalledWith({
        where: {
          assignedProfessorId: 'prof-1',
          dayOfWeek: { not: null },
          startTime: { not: null },
          endTime: { not: null },
        },
        include: {
          courseOffering: { include: { course: true, cohort: true } },
        },
      });
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Dr. Amal Ben Salah teaches DEV-101 LECTURE for SE - Year 1 on Monday from 08:30 to 10:00, during the time off Monday 08:00 to 12:00. Choose another teacher for that class on the Course Offerings page, or clear the timetable of its term on the home page, first.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('names every class that falls in a time off', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);
      prisma.classComponent.findMany.mockResolvedValue([
        mondayLecture,
        { ...mondayLecture, type: 'TD', startTime: '10:00', endTime: '11:30' },
      ]);

      const error: unknown = await service
        .setUnavailability('prof-1', { times: [monday('08:00', '18:30')] })
        .catch((caught: unknown) => caught);

      const message = (error as ConflictException).message;
      expect(message).toContain('DEV-101 LECTURE');
      expect(message).toContain('DEV-101 TD');
      expect(message).toMatch(/Choose another teacher for those classes/);
    });

    it('accepts a time off that starts when a class ends', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);
      prisma.classComponent.findMany.mockResolvedValue([mondayLecture]);

      await service.setUnavailability('prof-1', {
        times: [monday('10:00', '12:00')],
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('answers 404, and saves nothing, for a teacher that does not exist', async () => {
      prisma.professor.findUnique.mockResolvedValue(null);

      await expect(
        service.setUnavailability('gone', { times: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('saves only the fields that were sent', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);

      await service.update('prof-1', { maxHoursPerWeek: 16 });

      expect(prisma.professor.update).toHaveBeenCalledWith({
        where: { id: 'prof-1' },
        data: { maxHoursPerWeek: 16 },
      });
    });

    it('refuses, and saves nothing, a maximum below the hours the teacher already teaches', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);
      prisma.classComponent.findMany.mockResolvedValue([
        taught(360, 'Fall 2026', '2026-09-01', '2027-01-31'),
        taught(270, 'Fall 2026', '2026-09-01', '2027-01-31'),
      ]);

      const error: unknown = await service
        .update('prof-1', { maxHoursPerWeek: 10 })
        .catch((caught: unknown) => caught);

      expect(prisma.classComponent.findMany).toHaveBeenCalledWith({
        where: { assignedProfessorId: 'prof-1' },
        select: CLASS_HOURS,
      });
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Dr. Amal Ben Salah already teaches 10.5 hours a week in Fall 2026, so the maximum cannot be 10 hours. Choose other teachers for some of those classes on the Course Offerings page first, or keep a maximum of at least 10.5 hours.',
      );
      expect(prisma.professor.update).not.toHaveBeenCalled();
    });

    it('counts the classes of terms whose dates overlap as the same weeks', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);
      prisma.classComponent.findMany.mockResolvedValue([
        taught(360, 'Fall 2026', '2026-09-01', '2027-01-31'),
        taught(120, 'Winter School', '2027-01-10', '2027-02-10'),
        taught(300, 'Summer 2027', '2027-06-01', '2027-07-31'),
      ]);

      await service.update('prof-1', { maxHoursPerWeek: 8 });
      expect(prisma.professor.update).toHaveBeenCalledTimes(1);

      const error: unknown = await service
        .update('prof-1', { maxHoursPerWeek: 7.5 })
        .catch((caught: unknown) => caught);
      expect((error as ConflictException).message).toMatch(
        /^Dr\. Amal Ben Salah already teaches 8 hours a week in Fall 2026, so the maximum cannot be 7\.5 hours\./,
      );
      expect(prisma.professor.update).toHaveBeenCalledTimes(1);
    });

    it('does not look at the classes when the maximum is not changed', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);

      await service.update('prof-1', { name: 'Dr. Amal Ben Salah' });

      expect(prisma.classComponent.findMany).not.toHaveBeenCalled();
      expect(prisma.professor.update).toHaveBeenCalledTimes(1);
    });

    it('answers 404, and changes nothing, for a teacher that does not exist', async () => {
      prisma.professor.findUnique.mockResolvedValue(null);

      await expect(
        service.update('gone', { name: 'Someone' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.professor.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a teacher who has no classes', async () => {
      prisma.professor.findUnique.mockResolvedValue({
        ...teacher,
        _count: { classes: 0 },
      });

      await service.remove('prof-1');

      expect(prisma.professor.delete).toHaveBeenCalledWith({
        where: { id: 'prof-1' },
      });
    });

    it('refuses, and says why, while the teacher has classes', async () => {
      prisma.professor.findUnique.mockResolvedValue({
        ...teacher,
        _count: { classes: 3 },
      });

      const error: unknown = await service
        .remove('prof-1')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Dr. Amal Ben Salah teaches 3 classes, so this teacher cannot be deleted. Assign those classes to another teacher first.',
      );
      expect(prisma.professor.delete).not.toHaveBeenCalled();
    });

    it('says "1 class" when there is only one', async () => {
      prisma.professor.findUnique.mockResolvedValue({
        ...teacher,
        _count: { classes: 1 },
      });

      const error: unknown = await service
        .remove('prof-1')
        .catch((caught: unknown) => caught);

      expect((error as ConflictException).message).toBe(
        'Dr. Amal Ben Salah teaches 1 class, so this teacher cannot be deleted. Assign that class to another teacher first.',
      );
    });

    it('answers 404 for a teacher that does not exist', async () => {
      prisma.professor.findUnique.mockResolvedValue(null);

      await expect(service.remove('gone')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.professor.delete).not.toHaveBeenCalled();
    });
  });
});
