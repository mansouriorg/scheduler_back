import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from './scheduler.service';

// Tests for timetable generation. The database (PrismaService) and the call to
// scheduler-brain (HttpService) are stand-ins: nothing real is read, saved or sent.

const room = {
  id: 'room-1',
  name: 'Lab 304',
  capacity: 30,
  roomType: 'COMPUTER_LAB',
  equipment: ['COMPUTERS', 'PROJECTOR'],
  floorId: 'floor-1',
  floor: {
    id: 'floor-1',
    level: '3',
    buildingId: 'building-1',
    building: {
      id: 'building-1',
      name: 'Science Hub',
      code: 'SCI',
      campusId: 'campus-1',
    },
  },
};

const professor = {
  id: 'prof-1',
  name: 'Dr. Amal Ben Salah',
  department: 'Computer Science',
  maxHoursPerWeek: 12,
  timePreference: 'MORNING',
  isStrictTimeRequirement: false,
  unavailability: [
    {
      id: 'off-1',
      dayOfWeek: 'FRIDAY',
      startTime: '08:00',
      endTime: '18:00',
      professorId: 'prof-1',
    },
  ],
};

// A class part that has no day, time or room yet, as the database returns it.
// Its cohort has 25 students unless another headcount is given; 2 students are
// enrolled in its course offering.
function unscheduledClass(
  id: string,
  type: string,
  professorId: string | null,
  headcount = 25,
) {
  return {
    id,
    type,
    durationMinutes: 90,
    requiresRoomType: 'COMPUTER_LAB',
    requiredEquipment: ['COMPUTERS'],
    mustFollowType: null,
    courseOfferingId: 'offering-1',
    assignedProfessorId: professorId,
    assignedRoomId: null,
    dayOfWeek: null,
    startTime: null,
    endTime: null,
    isRecurringWeekly: true,
    courseOffering: {
      id: 'offering-1',
      termId: 'term-1',
      courseId: 'course-1',
      cohortId: 'cohort-1',
      course: { id: 'course-1', code: 'DEV-101', title: 'Web Development' },
      cohort: {
        id: 'cohort-1',
        name: 'Software Engineering - Year 1',
        headcount,
      },
      enrollments: [{ studentId: 'student-1' }, { studentId: 'student-2' }],
    },
  };
}

// What scheduler-brain must receive for the data above.
const expectedPayload = {
  rooms: [
    {
      id: 'room-1',
      name: 'Lab 304',
      capacity: 30,
      roomType: 'COMPUTER_LAB',
      campusId: 'campus-1',
      buildingId: 'building-1',
      equipment: ['COMPUTERS', 'PROJECTOR'],
    },
  ],
  professors: [
    {
      id: 'prof-1',
      name: 'Dr. Amal Ben Salah',
      maxHoursPerWeek: 12,
      timePreference: 'MORNING',
      isStrictTimeRequirement: false,
      unavailableDays: ['FRIDAY'],
    },
  ],
  classes: [
    {
      id: 'class-1',
      courseCode: 'DEV-101',
      durationMinutes: 90,
      requiresRoomType: 'COMPUTER_LAB',
      requiredEquipment: ['COMPUTERS'],
      componentType: 'TD',
      professorId: 'prof-1',
      cohortId: 'cohort-1',
      cohortHeadcount: 25,
      studentIds: ['student-1', 'student-2'],
    },
    {
      id: 'class-2',
      courseCode: 'DEV-101',
      durationMinutes: 90,
      requiresRoomType: 'COMPUTER_LAB',
      requiredEquipment: ['COMPUTERS'],
      componentType: 'TP',
      professorId: null,
      cohortId: 'cohort-1',
      cohortHeadcount: 25,
      studentIds: ['student-1', 'student-2'],
    },
  ],
};

// The settings read by the service; every test starts without them (the defaults).
const SOLVER_SETTINGS = ['SOLVER_URL', 'SOLVER_TIMEOUT_SECONDS'];
const THIRTY_MINUTES = 30 * 60 * 1000;

type PrismaStandIn = {
  room: { findMany: jest.Mock };
  professor: { findMany: jest.Mock };
  classComponent: { findMany: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
};

describe('SchedulerService', () => {
  let service: SchedulerService;
  let prisma: PrismaStandIn;
  let http: { post: jest.Mock };
  let savedSettings: Record<string, string | undefined>;

  beforeEach(async () => {
    savedSettings = {};
    for (const name of SOLVER_SETTINGS) {
      savedSettings[name] = process.env[name];
      delete process.env[name];
    }

    prisma = {
      room: { findMany: jest.fn().mockResolvedValue([room]) },
      professor: { findMany: jest.fn().mockResolvedValue([professor]) },
      classComponent: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            unscheduledClass('class-1', 'TD', 'prof-1'),
            unscheduledClass('class-2', 'TP', null),
          ]),
        // Prisma runs an update only inside $transaction; this stand-in just
        // returns a note of what would be saved.
        update: jest.fn((args: { where: { id: string } }) => ({
          saves: args.where.id,
        })),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    http = { post: jest.fn() };

    // The service prints progress lines; keep them out of the test output.
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: HttpService, useValue: http },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const name of SOLVER_SETTINGS) {
      const value = savedSettings[name];
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('only picks Semester 1 classes that have no time yet', async () => {
    prisma.classComponent.findMany.mockResolvedValue([]);

    await service.autoGenerate();

    expect(prisma.classComponent.findMany).toHaveBeenCalledWith({
      where: {
        startTime: null,
        courseOffering: { term: { type: 'SEMESTER_1' } },
      },
      include: {
        courseOffering: {
          include: {
            course: true,
            cohort: true,
            enrollments: { select: { studentId: true } },
          },
        },
      },
    });
  });

  it('says so, and calls nothing, when every class already has a time', async () => {
    prisma.classComponent.findMany.mockResolvedValue([]);

    const result = await service.autoGenerate();

    expect(result).toEqual({
      message: 'All Semester 1 classes are already scheduled! Nothing to do.',
    });
    expect(http.post).not.toHaveBeenCalled();
    expect(prisma.classComponent.update).not.toHaveBeenCalled();
  });

  it('sends rooms, professors and classes to scheduler-brain', async () => {
    http.post.mockReturnValue(
      of({ data: { success: true, scheduledClasses: [] } }),
    );

    await service.autoGenerate();

    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/solve',
      expectedPayload,
      { timeout: THIRTY_MINUTES },
    );
  });

  it('sizes a class by its enrolled students when there are more than the headcount', async () => {
    prisma.classComponent.findMany.mockResolvedValue([
      unscheduledClass('class-1', 'TD', 'prof-1', 1),
    ]);
    http.post.mockReturnValue(
      of({ data: { success: true, scheduledClasses: [] } }),
    );

    await service.autoGenerate();

    expect(http.post).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/solve',
      {
        ...expectedPayload,
        classes: [{ ...expectedPayload.classes[0], cohortHeadcount: 2 }],
      },
      { timeout: THIRTY_MINUTES },
    );
  });

  it('says which class fits in no room, and calls nothing, when a cohort is too big for the rooms', async () => {
    prisma.classComponent.findMany.mockResolvedValue([
      unscheduledClass('class-1', 'TD', 'prof-1', 45),
    ]);

    const error: unknown = await service
      .autoGenerate()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    const httpError = error as HttpException;
    expect(httpError.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(httpError.message).toBe(
      'The timetable cannot be made, because 1 class has no room it fits in. ' +
        'DEV-101 TD for Software Engineering - Year 1 has 45 students, but the largest room of type "Computer Lab" with PC Computers has 30 seats. ' +
        'Add or change rooms on the Classrooms page, or check the headcount of the cohorts.',
    );
    expect(http.post).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses SOLVER_URL and SOLVER_TIMEOUT_SECONDS when they are set', async () => {
    process.env.SOLVER_URL = 'http://brain.internal:9000/';
    process.env.SOLVER_TIMEOUT_SECONDS = '600';
    http.post.mockReturnValue(
      of({ data: { success: true, scheduledClasses: [] } }),
    );

    await service.autoGenerate();

    expect(http.post).toHaveBeenCalledWith(
      'http://brain.internal:9000/solve',
      expectedPayload,
      { timeout: 600000 },
    );
  });

  it('saves the room, day and time chosen for each class', async () => {
    http.post.mockReturnValue(
      of({
        data: {
          success: true,
          scheduledClasses: [
            {
              classId: 'class-1',
              roomId: 'room-1',
              dayOfWeek: 'MONDAY',
              startTime: '08:30',
              endTime: '10:00',
            },
            {
              classId: 'class-2',
              roomId: 'room-1',
              dayOfWeek: 'TUESDAY',
              startTime: '10:00',
              endTime: '11:30',
            },
          ],
        },
      }),
    );

    const result = await service.autoGenerate();

    // Both updates go into one transaction, in this order.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith([
      { saves: 'class-1' },
      { saves: 'class-2' },
    ]);
    expect(prisma.classComponent.update).toHaveBeenCalledTimes(2);
    expect(prisma.classComponent.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'class-1' },
      data: {
        assignedRoomId: 'room-1',
        dayOfWeek: 'MONDAY',
        startTime: '08:30',
        endTime: '10:00',
      },
    });
    expect(prisma.classComponent.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'class-2' },
      data: {
        assignedRoomId: 'room-1',
        dayOfWeek: 'TUESDAY',
        startTime: '10:00',
        endTime: '11:30',
      },
    });
    expect(result).toMatchObject({ success: true });
    expect(result.message).toContain('Successfully scheduled 2 classes');
  });

  it('says that nothing was changed when saving the timetable fails', async () => {
    http.post.mockReturnValue(
      of({
        data: {
          success: true,
          scheduledClasses: [
            {
              classId: 'class-1',
              roomId: 'room-1',
              dayOfWeek: 'MONDAY',
              startTime: '08:30',
              endTime: '10:00',
            },
          ],
        },
      }),
    );
    prisma.$transaction.mockRejectedValue(
      new Error('Record to update not found.'),
    );

    const error: unknown = await service
      .autoGenerate()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    const httpError = error as HttpException;
    expect(httpError.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(httpError.message).toBe(
      'Could not save the timetable, so no class was changed. The brain_server terminal shows the details.',
    );
  });

  it('passes on the reason, and saves nothing, when no timetable is possible', async () => {
    const reason =
      'Impossible Setup: Professor Dr. Amal Ben Salah is assigned 15.0 hours, but their max is 12.';
    http.post.mockReturnValue(
      of({ data: { success: false, scheduledClasses: [], message: reason } }),
    );

    const error: unknown = await service
      .autoGenerate()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    const httpError = error as HttpException;
    expect(httpError.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(httpError.message).toBe(reason);
    expect(prisma.classComponent.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('gives a general reason when scheduler-brain sends none', async () => {
    http.post.mockReturnValue(
      of({ data: { success: false, scheduledClasses: [] } }),
    );

    const error: unknown = await service
      .autoGenerate()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).message).toBe(
      'scheduler-brain found no possible timetable.',
    );
  });

  it('says where it looked, and saves nothing, when scheduler-brain cannot be reached', async () => {
    http.post.mockReturnValue(
      throwError(
        () =>
          new AxiosError('connect ECONNREFUSED 127.0.0.1:8000', 'ECONNREFUSED'),
      ),
    );

    const error: unknown = await service
      .autoGenerate()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    const httpError = error as HttpException;
    expect(httpError.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(httpError.message).toBe(
      'Cannot reach scheduler-brain at http://127.0.0.1:8000/solve. Start it, then try again.',
    );
    expect(prisma.classComponent.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
