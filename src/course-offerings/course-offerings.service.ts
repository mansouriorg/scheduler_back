import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCourseOfferingDto } from './dto/create-course-offering.dto';
import { UpdateCourseOfferingDto } from './dto/update-course-offering.dto';
import { AssignTeachersDto } from './dto/assign-teachers.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  findTeacherProblems,
  refusalAdvice,
  type TeacherClass,
} from '../common/teacher-fit';

const OFFERING_NOT_FOUND =
  'This course offering does not exist any more. Reload the page to see the current list.';
const CLASS_NOT_FOUND =
  'This class does not exist any more. Reload the page to see the current list.';
const TEACHER_NOT_FOUND =
  'This teacher does not exist any more. Reload the page to see the current list.';

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

// An offering as assignTeachers reads it: names, term dates and classes.
type OfferingWithClasses = {
  id: string;
  term: { name: string; startDate: Date; endDate: Date };
  course: { code: string };
  cohort: { name: string };
  classes: (Omit<TeacherClass, 'label'> & { id: string; type: string })[];
};

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
        // Lecture, TD, TP, always in the same order.
        classes: {
          include: { room: ROOM_PLACE },
          orderBy: [{ type: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: { term: { startDate: 'desc' } },
    });
  }

  // Moves an offering to another term or cohort; 404 when the offering, the
  // term or the cohort does not exist. Its course cannot change (400): its
  // classes were made from that course. A move is refused (409) when the course
  // is already offered to that cohort in that term, or when a teacher of its
  // classes would teach more hours a week in the new term than their maximum.
  // A new term or cohort takes the classes out of the timetable, because their
  // rooms and times were chosen for the old ones; generating the timetable
  // places them again.
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
      const term = await this.refuseMissing(termId, cohortId);
      await this.refuseTwin(offering.courseId, termId, cohortId, id);
      if (termId !== offering.termId) {
        await this.refuseOverloadedTeachers(offering, term);
      }
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

  // Sets the teacher of some classes of an offering (professorId null: no
  // teacher). The classes keep their room, day and time. All changes are saved
  // together, or none: a teacher is refused (409, saying why) who would teach
  // more hours a week than their maximum, or who is busy or not available at
  // the time of a class that is already in the timetable. 404 when the
  // offering, a class or a teacher does not exist any more.
  async assignTeachers(id: string, dto: AssignTeachersDto) {
    const offering = await this.prisma.courseOffering.findUnique({
      where: { id },
      include: {
        term: { select: { name: true, startDate: true, endDate: true } },
        course: { select: { code: true } },
        cohort: { select: { name: true } },
        classes: true,
      },
    });
    if (offering === null) {
      throw new NotFoundException(OFFERING_NOT_FOUND);
    }
    const before = new Map(
      offering.classes.map((cls) => [cls.id, cls.assignedProfessorId]),
    );
    const listed = new Set<string>();
    for (const { classId } of dto.classes) {
      if (before.has(classId) === false) {
        throw new NotFoundException(CLASS_NOT_FOUND);
      }
      if (listed.has(classId)) {
        throw new BadRequestException('Each class can be listed only once.');
      }
      listed.add(classId);
    }
    // Only the classes whose teacher really changes are checked and saved.
    const changes = dto.classes
      .map(({ classId, professorId }) => ({
        classId,
        professorId: professorId ?? null,
      }))
      .filter(
        ({ classId, professorId }) => before.get(classId) !== professorId,
      );
    if (changes.length === 0) {
      return { changed: 0 };
    }

    // The teacher of each class once the changes are saved, and the teachers
    // who get a class (taking a teacher off a class is never refused).
    const after = new Map(before);
    for (const { classId, professorId } of changes) {
      after.set(classId, professorId);
    }
    const teacherIds = [
      ...new Set(
        changes.flatMap(({ professorId }) =>
          professorId === null ? [] : [professorId],
        ),
      ),
    ];
    if (teacherIds.length > 0) {
      await this.refuseUnfitTeachers(offering, before, after, teacherIds);
    }

    await this.prisma.$transaction(
      changes.map(({ classId, professorId }) =>
        this.prisma.classComponent.update({
          where: { id: classId },
          data: { assignedProfessorId: professorId },
        }),
      ),
    );
    return { changed: changes.length };
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

  // 409, saying why, when a teacher would teach more hours a week than their
  // maximum with these classes, or is busy or not available at the time of a
  // class that is already in the timetable. 404 when a teacher was deleted.
  // before and after: the teacher of each class before and after the change.
  private async refuseUnfitTeachers(
    offering: OfferingWithClasses,
    before: Map<string, string | null>,
    after: Map<string, string | null>,
    teacherIds: string[],
  ) {
    const teachers = await this.prisma.professor.findMany({
      where: { id: { in: teacherIds } },
      include: { unavailability: true },
    });
    const label = (type: string) =>
      `${offering.course.code} ${type} for ${offering.cohort.name}`;
    const time: string[] = [];
    const hours: string[] = [];
    for (const teacherId of teacherIds) {
      const teacher = teachers.find((one) => one.id === teacherId);
      if (teacher === undefined) {
        throw new NotFoundException(TEACHER_NOT_FOUND);
      }
      // The teacher's classes in other offerings whose term shares days with
      // this one: those weeks count for the hours and the times.
      const elsewhere = await this.prisma.classComponent.findMany({
        where: {
          assignedProfessorId: teacherId,
          courseOfferingId: { not: offering.id },
          courseOffering: {
            term: {
              startDate: { lte: offering.term.endDate },
              endDate: { gte: offering.term.startDate },
            },
          },
        },
        include: { courseOffering: { include: NAMES } },
      });
      const mine = offering.classes.filter(
        (cls) => after.get(cls.id) === teacherId,
      );
      const added: TeacherClass[] = mine
        .filter((cls) => before.get(cls.id) !== teacherId)
        .map((cls) => ({ ...cls, label: label(cls.type) }));
      const kept: TeacherClass[] = [
        ...mine
          .filter((cls) => before.get(cls.id) === teacherId)
          .map((cls) => ({ ...cls, label: label(cls.type) })),
        ...elsewhere.map((cls) => ({
          ...cls,
          label: `${cls.courseOffering.course.code} ${cls.type} for ${cls.courseOffering.cohort.name}`,
        })),
      ];
      const problems = findTeacherProblems(
        teacher,
        added,
        kept,
        offering.term.name,
      );
      time.push(...problems.time);
      hours.push(...problems.hours);
    }
    if (time.length > 0 || hours.length > 0) {
      throw new ConflictException(
        [
          ...time,
          ...hours,
          refusalAdvice(hours.length > 0, time.length > 0),
        ].join(' '),
      );
    }
  }

  // 409, saying why, when a teacher of the offering's classes would teach more
  // hours a week than their maximum in the new term (with their classes of
  // terms whose dates overlap it). The classes leave the timetable with the
  // move, so only the hours count, not the times.
  private async refuseOverloadedTeachers(
    offering: {
      id: string;
      course: { code: string };
      cohort: { name: string };
    },
    term: { name: string; startDate: Date; endDate: Date },
  ) {
    const classes = await this.prisma.classComponent.findMany({
      where: {
        courseOfferingId: offering.id,
        assignedProfessorId: { not: null },
      },
    });
    const teacherIds = [
      ...new Set(
        classes
          .map((cls) => cls.assignedProfessorId)
          .filter((teacherId): teacherId is string => teacherId !== null),
      ),
    ];
    if (teacherIds.length === 0) {
      return;
    }
    const teachers = await this.prisma.professor.findMany({
      where: { id: { in: teacherIds } },
      include: { unavailability: true },
    });
    const hours: string[] = [];
    for (const teacher of teachers) {
      const elsewhere = await this.prisma.classComponent.findMany({
        where: {
          assignedProfessorId: teacher.id,
          courseOfferingId: { not: offering.id },
          courseOffering: {
            term: {
              startDate: { lte: term.endDate },
              endDate: { gte: term.startDate },
            },
          },
        },
        include: { courseOffering: { include: NAMES } },
      });
      // Out of the timetable after the move: no day and no time.
      const added: TeacherClass[] = classes
        .filter((cls) => cls.assignedProfessorId === teacher.id)
        .map((cls) => ({
          label: `${offering.course.code} ${cls.type} for ${offering.cohort.name}`,
          durationMinutes: cls.durationMinutes,
          dayOfWeek: null,
          startTime: null,
          endTime: null,
        }));
      const kept: TeacherClass[] = elsewhere.map((cls) => ({
        ...cls,
        label: `${cls.courseOffering.course.code} ${cls.type} for ${cls.courseOffering.cohort.name}`,
      }));
      hours.push(...findTeacherProblems(teacher, added, kept, term.name).hours);
    }
    if (hours.length > 0) {
      throw new ConflictException(
        [...hours, refusalAdvice(true, false)].join(' '),
      );
    }
  }

  // 404 when the term or the cohort was deleted in the meantime. Returns the
  // term.
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
    return term;
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
