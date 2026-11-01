import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';
import { PrismaService } from '../prisma/prisma.service';
import { describeItems } from '../common/describe-items';
import { classSize, joinNames } from '../common/room-fit';

const COHORT_NOT_FOUND =
  'This cohort does not exist any more. Reload the page to see the current list.';

// A cohort with its course offerings and the classes of those that are booked
// in a room, as update reads it.
type CohortWithBookedClasses = {
  name: string;
  headcount: number;
  courseOfferings: {
    course: { code: string };
    _count: { enrollments: number };
    classes: {
      type: string;
      room: { name: string; capacity: number } | null;
    }[];
  }[];
};

@Injectable()
export class CohortsService {
  constructor(private prisma: PrismaService) {}

  async create(createCohortDto: CreateCohortDto) {
    return this.prisma.cohort.create({
      data: createCohortDto,
    });
  }

  async findAll() {
    return this.prisma.cohort.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Changes only the fields that were sent; 404 when the cohort does not exist.
  // The headcount is the size of the cohort's classes (see classSize), so a
  // larger headcount is refused (409) when a class booked in a room would no
  // longer have a seat for each student there. The name and the semester do
  // not matter to the timetable.
  async update(id: string, updateCohortDto: UpdateCohortDto) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id },
      include: {
        courseOfferings: {
          select: {
            course: { select: { code: true } },
            _count: { select: { enrollments: true } },
            classes: {
              where: { assignedRoomId: { not: null } },
              select: {
                type: true,
                room: { select: { name: true, capacity: true } },
              },
            },
          },
        },
      },
    });
    if (cohort === null) {
      throw new NotFoundException(COHORT_NOT_FOUND);
    }
    if (updateCohortDto.headcount !== undefined) {
      const reason = whyTheHeadcountIsRefused(
        cohort,
        updateCohortDto.headcount,
      );
      if (reason !== null) {
        throw new ConflictException(reason);
      }
    }
    return this.prisma.cohort.update({ where: { id }, data: updateCohortDto });
  }

  // Deletes a cohort without course offerings and students. Otherwise the
  // delete is refused (409): the database would delete its course offerings
  // and their classes along with it, and it cannot delete a cohort that
  // students still belong to.
  async remove(id: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id },
      include: {
        courseOfferings: {
          select: {
            course: { select: { code: true } },
            term: { select: { name: true } },
          },
          orderBy: { course: { code: 'asc' } },
        },
        _count: { select: { students: true } },
      },
    });
    if (cohort === null) {
      throw new NotFoundException(COHORT_NOT_FOUND);
    }
    const offerings = cohort.courseOfferings.map(
      (offering) => `${offering.course.code} in ${offering.term.name}`,
    );
    const students = cohort._count.students;
    if (offerings.length === 0 && students === 0) {
      return this.prisma.cohort.delete({ where: { id } });
    }

    const what: string[] = [];
    const todo: string[] = [];
    if (offerings.length > 0) {
      what.push(
        describeItems(offerings, 'course offering', 'course offerings'),
      );
      todo.push(
        offerings.length === 1
          ? 'delete that course offering'
          : 'delete those course offerings',
      );
    }
    if (students > 0) {
      what.push(students === 1 ? '1 student' : `${students} students`);
      todo.push(
        students === 1
          ? 'move that student to another cohort'
          : 'move those students to another cohort',
      );
    }
    const steps = todo.join(' and ');
    throw new ConflictException(
      `${cohort.name} has ${what.join(' and ')}, so it cannot be deleted. First ${steps}.`,
    );
  }
}

// Says why the new headcount is refused, or returns null when every booked
// class of the cohort still has a seat for each student in its room. Only what
// the change takes away counts: a class that was already too big for its room
// does not block the change.
function whyTheHeadcountIsRefused(
  cohort: CohortWithBookedClasses,
  headcount: number,
): string | null {
  const classes: string[] = [];
  const rooms = new Map<string, number>();
  for (const offering of cohort.courseOfferings) {
    const enrolled = offering._count.enrollments;
    const before = classSize(cohort.headcount, enrolled);
    const after = classSize(headcount, enrolled);
    for (const booked of offering.classes) {
      const room = booked.room;
      if (room !== null && before <= room.capacity && after > room.capacity) {
        classes.push(`${offering.course.code} ${booked.type}`);
        rooms.set(room.name, room.capacity);
      }
    }
  }
  if (classes.length === 0) {
    return null;
  }
  const where = joinNames(
    [...rooms].map(([name, seats]) => `${name} (${seats} seats)`),
  );
  const most = Math.min(...rooms.values());
  const which = describeItems(classes, 'of its classes', 'of its classes');
  const verb = classes.length === 1 ? 'is' : 'are';
  const stay = classes.length === 1 ? 'that class stays' : 'those classes stay';
  return `${cohort.name} cannot have ${headcount} students: ${which} ${verb} booked in ${where}. It can have at most ${most} students while ${stay} there.`;
}
