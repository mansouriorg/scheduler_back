import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  describeSolverFailure,
  solverEndpoint,
  solverTimeoutMs,
  type SolverAnswer,
} from './solver';
import { classSize, describeClassesWithoutRoom } from '../common/room-fit';

const TERM_NOT_FOUND =
  'This term does not exist any more. Reload the page to see the current list.';

@Injectable()
export class SchedulerService {
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
  ) {}

  // Places the classes of one term that are not in the timetable yet; the
  // classes already in the timetable stay where they are. 404 when the term
  // does not exist any more.
  async autoGenerate(termId: string) {
    const term = await this.findTerm(termId);
    console.log('🚀 Gathering data for the Python Brain (one term)...');
    
    // 1. Fetch resources from PostgreSQL with geographic and unavailability data
    const rooms = await this.prisma.room.findMany({
      include: {
        floor: {
          include: {
            building: true 
          }
        }
      }
    });
    
    // Fetch professors along with their specific days off
    const professors = await this.prisma.professor.findMany({
      include: {
        unavailability: true 
      }
    });
    
    // 🚨 Fetch ONLY the classes of the chosen term that haven't been scheduled yet!
    const classes = await this.prisma.classComponent.findMany({
      where: { 
        startTime: null,
        courseOffering: { termId: term.id },
      },
      include: { 
        courseOffering: { 
          include: { 
            course: true,
            cohort: true,
            // Fetch every individual student enrolled in this specific offering
            enrollments: { 
              select: { studentId: true } 
            }
          } 
        } 
      }
    });

    if (classes.length === 0) {
      const total = await this.prisma.classComponent.count({
        where: { courseOffering: { termId: term.id } },
      });
      return {
        message:
          total === 0
            ? `${term.name} has no classes yet. Add course offerings for it on the Course Offerings page first.`
            : `All classes of ${term.name} are already in the timetable. Nothing to do.`,
      };
    }

    // Stop here when a class fits in no room (type, seats or equipment):
    // scheduler-brain could only answer that no timetable is possible, without
    // saying which class or why. A class has as many students as its cohort's
    // headcount, or as are enrolled when there are more (see classSize).
    const sizeOf = (c: (typeof classes)[number]) =>
      classSize(
        c.courseOffering.cohort.headcount,
        c.courseOffering.enrollments.length,
      );
    const noRoom = describeClassesWithoutRoom(
      classes.map((c) => ({
        label: `${c.courseOffering.course.code} ${c.type} for ${c.courseOffering.cohort.name}`,
        size: sizeOf(c),
        requiresRoomType: c.requiresRoomType,
        requiredEquipment: c.requiredEquipment,
      })),
      rooms,
    );
    if (noRoom !== null) {
      throw new HttpException(noRoom, HttpStatus.BAD_REQUEST);
    }

    // The classes already in the timetable, in this term and in terms whose
    // dates overlap it: they keep their room, day and time, and
    // scheduler-brain places the new classes around them.
    const placed = await this.prisma.classComponent.findMany({
      where: {
        startTime: { not: null },
        courseOffering: {
          term: {
            startDate: { lte: term.endDate },
            endDate: { gte: term.startDate },
          },
        },
      },
      include: {
        courseOffering: {
          include: { enrollments: { select: { studentId: true } } },
        },
      },
    });
    const fixedClasses = placed.flatMap((c) =>
      c.assignedRoomId !== null &&
      c.dayOfWeek !== null &&
      c.startTime !== null &&
      c.endTime !== null
        ? [
            {
              id: c.id,
              roomId: c.assignedRoomId,
              dayOfWeek: c.dayOfWeek,
              startTime: c.startTime,
              endTime: c.endTime,
              durationMinutes: c.durationMinutes,
              professorId: c.assignedProfessorId,
              cohortId: c.courseOffering.cohortId,
              studentIds: c.courseOffering.enrollments.map((e) => e.studentId),
            },
          ]
        : [],
    );

    // 2. Format the payload to perfectly match Python's ultimate Pydantic models
    const payload = {
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        roomType: r.roomType,
        campusId: r.floor.building.campusId, 
        buildingId: r.floor.building.id,      
        equipment: r.equipment || [] 
      })),
      professors: professors.map(p => ({
        id: p.id,
        name: p.name,
        maxHoursPerWeek: p.maxHoursPerWeek,
        timePreference: p.timePreference,
        isStrictTimeRequirement: p.isStrictTimeRequirement, // 🚨 NEW: Passing the bypass flag to Python!
        // The times each week when the teacher cannot teach (a whole day is
        // 08:00 to 18:30): scheduler-brain keeps their classes out of them.
        unavailableTimes: (p.unavailability || []).map((u) => ({
          dayOfWeek: u.dayOfWeek,
          startTime: u.startTime,
          endTime: u.endTime,
        })),
      })),
      classes: classes.map(c => ({
        id: c.id,
        courseCode: c.courseOffering.course.code,
        durationMinutes: c.durationMinutes,
        requiresRoomType: c.requiresRoomType,
        requiredEquipment: c.requiredEquipment || [], 
        componentType: c.type,                        
        professorId: c.assignedProfessorId || null,
        cohortId: c.courseOffering.cohortId,
        // The class size, the same number the room check above uses.
        cohortHeadcount: sizeOf(c),
        studentIds: c.courseOffering.enrollments.map(e => e.studentId) 
      })),
      fixedClasses,
    };

    // 3. Send the puzzle to Python!
    // Where scheduler-brain is and how long to wait for it (see .env.example).
    const solverUrl = solverEndpoint(process.env.SOLVER_URL);
    const timeoutMs = solverTimeoutMs(process.env.SOLVER_TIMEOUT_SECONDS);
    try {
      console.log(`🧠 Sending ${payload.classes.length} classes to Python. Checking individual student conflicts...`);
      
      // 🚨 TIME LIMIT: waits up to SOLVER_TIMEOUT_SECONDS (default 30 minutes, 0 = no limit) for Python to optimize!
      const response = await firstValueFrom(
        this.httpService.post<SolverAnswer>(solverUrl, payload, {
          timeout: timeoutMs,
        }),
      );

      const result = response.data;

      if (!result.success) {
        throw new HttpException(
          result.message || 'scheduler-brain found no possible timetable.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 4. The puzzle is solved! Save the times and rooms back to PostgreSQL
      console.log('✅ Brain returned a valid schedule. Saving to database...');
      
      // One update per class, all run in a single transaction: either every
      // class gets its room and time, or (if one save fails) none of them does.
      const updates = result.scheduledClasses.map((scheduledClass) =>
        this.prisma.classComponent.update({
          where: { id: scheduledClass.classId },
          data: {
            assignedRoomId: scheduledClass.roomId,
            dayOfWeek: scheduledClass.dayOfWeek,
            startTime: scheduledClass.startTime,
            endTime: scheduledClass.endTime,
          },
        }),
      );
      try {
        await this.prisma.$transaction(updates);
      } catch (saveError) {
        console.error('Saving the timetable failed:', saveError);
        throw new HttpException(
          'Could not save the timetable, so no class was changed. The brain_server terminal shows the details.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      const savedCount = updates.length;

      return { 
        success: true, 
        message: `Successfully scheduled ${savedCount} classes checking thousands of individual student conflicts!` 
      };

    } catch (error: any) {
      // "No timetable is possible" (thrown above) already carries the solver's
      // own reason: pass it on as it is instead of hiding it.
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Timetable generation failed:', error?.response?.data || error.message);
      // Say what went wrong: solver not running, too slow, or answering with an error.
      throw describeSolverFailure(error, solverUrl, timeoutMs);
    }
  }

  // Takes the room, day and time off every class of a term (or of every term
  // when none is given) that has one, in one write, so the next generation
  // places all of them again. The classes, their teachers and everything else
  // stay. Says how many classes were cleared; 404 when the term does not exist.
  async clearTimetable(termId?: string) {
    const term = termId === undefined ? null : await this.findTerm(termId);
    const { count } = await this.prisma.classComponent.updateMany({
      where: {
        OR: [
          { assignedRoomId: { not: null } },
          { dayOfWeek: { not: null } },
          { startTime: { not: null } },
          { endTime: { not: null } },
        ],
        ...(term === null ? {} : { courseOffering: { termId: term.id } }),
      },
      data: {
        assignedRoomId: null,
        dayOfWeek: null,
        startTime: null,
        endTime: null,
      },
    });
    const ofTerm = term === null ? '' : ` of ${term.name}`;
    const cleared =
      count === 1 ? `1 class${ofTerm} was` : `${count} classes${ofTerm} were`;
    return {
      cleared: count,
      message:
        count === 0
          ? `The timetable${ofTerm} is already empty.`
          : `${cleared} taken out of the timetable. Generate the timetable to place ${count === 1 ? 'it' : 'them'} again.`,
    };
  }

  private async findTerm(id: string) {
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (term === null) {
      throw new NotFoundException(TERM_NOT_FOUND);
    }
    return term;
  }
}
