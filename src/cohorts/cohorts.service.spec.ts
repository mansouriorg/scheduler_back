import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CohortsService } from './cohorts.service';

// Tests for changing and deleting cohorts. The database (PrismaService) is a
// stand-in: nothing real is read or written.

const cohort = {
  id: 'cohort-1',
  name: 'SE - Year 1',
  headcount: 45,
  currentSemester: 'SEMESTER_1',
};

// An offering of a course to the cohort, as the service reads it for a delete.
const offering = (code: string, term: string) => ({
  course: { code },
  term: { name: term },
});

// An offering as the service reads it for a change: its classes that are
// booked in a room (name, seats), and how many students are enrolled.
const bookedOffering = (
  code: string,
  classes: [string, string, number][],
  enrolled = 0,
) => ({
  course: { code },
  _count: { enrollments: enrolled },
  classes: classes.map(([type, room, capacity]) => ({
    type,
    room: { name: room, capacity },
  })),
});

type PrismaStandIn = {
  cohort: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

describe('CohortsService', () => {
  let service: CohortsService;
  let prisma: PrismaStandIn;

  // The cohort as findUnique returns it for a change.
  const cohortBookedIn = (
    ...courseOfferings: ReturnType<typeof bookedOffering>[]
  ) =>
    prisma.cohort.findUnique.mockResolvedValue({ ...cohort, courseOfferings });

  // The cohort as findUnique returns it for a delete.
  const cohortWith = (
    courseOfferings: ReturnType<typeof offering>[],
    students: number,
  ) =>
    prisma.cohort.findUnique.mockResolvedValue({
      ...cohort,
      courseOfferings,
      _count: { students },
    });

  const refusal = (promise: Promise<unknown>) =>
    promise.catch((caught: unknown) => caught);

  beforeEach(async () => {
    prisma = {
      cohort: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(cohort),
        delete: jest.fn().mockResolvedValue(cohort),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CohortsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CohortsService>(CohortsService);
  });

  it('changes the fields that were sent', async () => {
    cohortBookedIn(bookedOffering('DEV-101', [['TD', 'Room 12', 50]]));

    await service.update('cohort-1', { headcount: 48 });

    expect(prisma.cohort.update).toHaveBeenCalledWith({
      where: { id: 'cohort-1' },
      data: { headcount: 48 },
    });
  });

  it('refuses more students than a booked class has seats for in its room', async () => {
    cohortBookedIn(
      bookedOffering('DEV-101', [
        ['TD', 'Room 12', 50],
        ['TP', 'Lab 304', 48],
      ]),
      bookedOffering('DB-201', [['TP', 'Lab 305', 46]]),
    );

    const error = await refusal(service.update('cohort-1', { headcount: 49 }));

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(
      'SE - Year 1 cannot have 49 students: 2 of its classes (DEV-101 TP, DB-201 TP) are booked in Lab 304 (48 seats) and Lab 305 (46 seats). It can have at most 46 students while those classes stay there.',
    );
    expect(prisma.cohort.update).not.toHaveBeenCalled();
  });

  it('only counts classes that the new headcount makes too big', async () => {
    // Lab 300 is already too small for 45 students; more enrolled students
    // than the new headcount keep the size of DB-201 at 60.
    cohortBookedIn(
      bookedOffering('DEV-101', [['TP', 'Lab 300', 40]]),
      bookedOffering('DB-201', [['TD', 'Room 12', 60]], 60),
    );

    await service.update('cohort-1', { headcount: 55 });

    expect(prisma.cohort.update).toHaveBeenCalled();
  });

  it('answers 404, and changes nothing, for a cohort that does not exist', async () => {
    prisma.cohort.findUnique.mockResolvedValue(null);

    await expect(
      service.update('gone', { name: 'SE - Year 2' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.cohort.update).not.toHaveBeenCalled();
  });

  it('deletes a cohort without course offerings and students', async () => {
    cohortWith([], 0);

    await service.remove('cohort-1');

    expect(prisma.cohort.delete).toHaveBeenCalledWith({
      where: { id: 'cohort-1' },
    });
  });

  it('refuses, and says why, while the cohort has course offerings', async () => {
    cohortWith(
      [offering('DB-201', 'Fall 2026'), offering('DEV-101', 'Fall 2026')],
      0,
    );

    const error = await refusal(service.remove('cohort-1'));

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(
      'SE - Year 1 has 2 course offerings (DB-201 in Fall 2026, DEV-101 in Fall 2026), so it cannot be deleted. First delete those course offerings.',
    );
    expect(prisma.cohort.delete).not.toHaveBeenCalled();
  });

  it('refuses while a student still belongs to the cohort', async () => {
    cohortWith([], 1);

    const error = await refusal(service.remove('cohort-1'));

    expect((error as ConflictException).message).toBe(
      'SE - Year 1 has 1 student, so it cannot be deleted. First move that student to another cohort.',
    );
    expect(prisma.cohort.delete).not.toHaveBeenCalled();
  });

  it('names both reasons when there are offerings and students', async () => {
    cohortWith([offering('DEV-101', 'Fall 2026')], 45);

    const error = await refusal(service.remove('cohort-1'));

    expect((error as ConflictException).message).toBe(
      'SE - Year 1 has 1 course offering (DEV-101 in Fall 2026) and 45 students, so it cannot be deleted. First delete that course offering and move those students to another cohort.',
    );
  });

  it('answers 404 when deleting a cohort that does not exist', async () => {
    prisma.cohort.findUnique.mockResolvedValue(null);

    await expect(service.remove('gone')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.cohort.delete).not.toHaveBeenCalled();
  });
});
