import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCourseOfferingDto } from './dto/create-course-offering.dto';
import { UpdateCourseOfferingDto } from './dto/update-course-offering.dto';
import { PrismaService } from '../prisma/prisma.service';

const OFFERING_NOT_FOUND =
  'This course offering does not exist any more. Reload the page to see the current list.';

// The term, course and cohort of an offering, with their names.
const NAMES = {
  term: { select: { name: true } },
  course: { select: { code: true } },
  cohort: { select: { name: true } },
} as const;

// The name of a room and where it is: building and floor.
const ROOM_PLACE = {
  select: {
    name: true,
    floor: {
      select: {
        level: true,
        building: { select: { name: true, code: true } },
      },
    },
  },
} as const;

// "DEV-101 for SE - Year 1 in Fall 2026".
function describeOffering(offering: {
  course: { code: string };
  cohort: { name: string };
  term: { name: string };
}): string {
  return `${offering.course.code} for ${offering.cohort.name} in ${offering.term.name}`;
}

@Injectable()
export class CourseOfferingsService {
  constructor(private prisma: PrismaService) {}

  // Creates an offering with one class for each part of the course (lecture,
  // TD, TP), ready to be placed in the timetable. A course is offered to a
  // cohort only once per term (409 otherwise).
  async create(dto: CreateCourseOfferingDto) {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: { componentsTemplate: true },
    });
    if (course === null) {
      throw new NotFoundException(
        'This course does not exist any more. Reload the page to see the current list.',
      );
    }
    await this.refuseTwin(dto.courseId, dto.termId, dto.cohortId);

    return this.prisma.courseOffering.create({
      data: {
        termId: dto.termId,
        courseId: dto.courseId,
        cohortId: dto.cohortId,
        // One class for each part of the course; the timetable gives each a
        // room, a day and a time.
        classes: {
          create: course.componentsTemplate.map((template) => ({
            type: template.type,
            durationMinutes: Math.round(template.hoursPerSession * 60), // 1.5 hours is 90 minutes
            requiresRoomType: template.requiresRoomType,
            requiredEquipment: template.requiredEquipment,
            mustFollowType: template.mustFollowType,
            isRecurringWeekly: true, // the class takes place every week
          })),
        },
      },
      include: { classes: true },
    });
  }

  async findAll() {
    // Everything the Offerings page and the timetable show: names, and the
    // classes with the name and place of their room.
    return this.prisma.courseOffering.findMany({
      include: {
        term: true,
        course: true,
        cohort: true,
        classes: { include: { room: ROOM_PLACE } },
      },
      orderBy: { term: { startDate: 'desc' } },
    });
  }

  // Moves an offering to another term or cohort; 404 when the offering, the
  // term or the cohort does not exist. Its course cannot change (400): its
  // classes were made from that course. A move is refused (409) when the course
  // is already offered to that cohort in that term. A new term or cohort takes
  // the classes out of the timetable, because their rooms and times were
  // chosen for the old ones; generating the timetable places them again.
  async update(id: string, dto: UpdateCourseOfferingDto) {
    const offering = await this.prisma.courseOffering.findUnique({
      where: { id },
      include: NAMES,
    });
    if (offering === null) {
      throw new NotFoundException(OFFERING_NOT_FOUND);
    }
    if (dto.courseId !== undefined && dto.courseId !== offering.courseId) {
      throw new BadRequestException(
        `The course of an offering cannot change: its classes were made from ${offering.course.code}. Delete this offering and add one for the other course.`,
      );
    }
    const termId = dto.termId ?? offering.termId;
    const cohortId = dto.cohortId ?? offering.cohortId;
    const moved = termId !== offering.termId || cohortId !== offering.cohortId;
    if (moved) {
      await this.refuseMissing(termId, cohortId);
      await this.refuseTwin(offering.courseId, termId, cohortId, id);
    }
    return this.prisma.courseOffering.update({
      where: { id },
      data: {
        termId,
        cohortId,
        ...(moved
          ? {
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
            }
          : {}),
      },
      include: { term: true, course: true, cohort: true, classes: true },
    });
  }

  // Deletes an offering together with its classes, which leave the timetable.
  // It is refused (409) while students are enrolled: their enrollment would be
  // lost, and the app cannot enroll students yet.
  async remove(id: string) {
    const offering = await this.prisma.courseOffering.findUnique({
      where: { id },
      include: { ...NAMES, _count: { select: { enrollments: true } } },
    });
    if (offering === null) {
      throw new NotFoundException(OFFERING_NOT_FOUND);
    }
    const students = offering._count.enrollments;
    if (students > 0) {
      const enrolled =
        students === 1 ? '1 enrolled student' : `${students} enrolled students`;
      throw new ConflictException(
        `${describeOffering(offering)} has ${enrolled}, so it cannot be deleted: their enrollment would be lost, and the app cannot enroll students yet.`,
      );
    }
    return this.prisma.courseOffering.delete({ where: { id } });
  }

  // 404 when the term or the cohort was deleted in the meantime.
  private async refuseMissing(termId: string, cohortId: string) {
    const term = await this.prisma.term.findUnique({ where: { id: termId } });
    if (term === null) {
      throw new NotFoundException(
        'This term does not exist any more. Reload the page to see the current list.',
      );
    }
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
    });
    if (cohort === null) {
      throw new NotFoundException(
        'This cohort does not exist any more. Reload the page to see the current list.',
      );
    }
  }

  // 409 when the course is already offered to the cohort in the term (by an
  // offering other than the one being changed).
  private async refuseTwin(
    courseId: string,
    termId: string,
    cohortId: string,
    exceptId?: string,
  ) {
    const twin = await this.prisma.courseOffering.findFirst({
      where: {
        courseId,
        termId,
        cohortId,
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      include: NAMES,
    });
    if (twin !== null) {
      throw new ConflictException(
        `${describeOffering(twin)} already exists, so the course cannot be offered to that cohort in that term again.`,
      );
    }
  }
}
