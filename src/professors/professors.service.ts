import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProfessorDto } from './dto/create-professor.dto';
import { UpdateProfessorDto } from './dto/update-professor.dto';
import { SetUnavailabilityDto, TimeOffDto } from './dto/set-unavailability.dto';
import { PrismaService } from '../prisma/prisma.service';
import { dayName, timesOverlap } from '../common/teacher-fit';

const TEACHER_NOT_FOUND =
  'This teacher does not exist any more. Reload the page to see the current list.';

const DAY_ORDER = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

// "Monday 08:00 to 12:00".
const timeOffText = (time: TimeOffDto) =>
  `${dayName(time.dayOfWeek)} ${time.startTime} to ${time.endTime}`;

@Injectable()
export class ProfessorsService {
  constructor(private prisma: PrismaService) {}

  async create(createProfessorDto: CreateProfessorDto) {
    // Saves the incoming data directly to PostgreSQL
    return this.prisma.professor.create({
      data: createProfessorDto,
    });
  }

  async findAll() {
    // Fetches all professors, alphabetized by name, each with their times off
    return this.prisma.professor.findMany({
      orderBy: { name: 'asc' },
      include: {
        unavailability: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    });
  }

  // Changes only the fields that were sent; 404 when the teacher does not exist.
  async update(id: string, updateProfessorDto: UpdateProfessorDto) {
    await this.findExisting(id);
    return this.prisma.professor.update({
      where: { id },
      data: updateProfessorDto,
    });
  }

  // Deletes a teacher who has no classes. While classes are assigned to the
  // teacher, the delete is refused (409) so that no class silently loses its
  // teacher. Their unavailable days go with them (onDelete: Cascade).
  async remove(id: string) {
    const professor = await this.prisma.professor.findUnique({
      where: { id },
      include: { _count: { select: { classes: true } } },
    });
    if (professor === null) {
      throw new NotFoundException(TEACHER_NOT_FOUND);
    }
    const classCount = professor._count.classes;
    if (classCount > 0) {
      const classes = classCount === 1 ? '1 class' : `${classCount} classes`;
      const those = classCount === 1 ? 'that class' : 'those classes';
      throw new ConflictException(
        `${professor.name} teaches ${classes}, so this teacher cannot be deleted. Assign ${those} to another teacher first.`,
      );
    }
    return this.prisma.professor.delete({ where: { id } });
  }

  // Replaces the times each week when the teacher cannot teach, all together.
  // Refused (400) when a time off ends before it starts or two of them
  // overlap, and (409) when a class of the teacher that is already in the
  // timetable falls in a time off. 404 when the teacher does not exist.
  async setUnavailability(id: string, dto: SetUnavailabilityDto) {
    const professor = await this.findExisting(id);
    const times = [...dto.times].sort(
      (a, b) =>
        DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek) ||
        a.startTime.localeCompare(b.startTime),
    );
    const backwards = times.find((time) => time.startTime >= time.endTime);
    if (backwards !== undefined) {
      throw new BadRequestException(
        `A time off must end after it starts: ${timeOffText(backwards)} does not.`,
      );
    }
    times.forEach((time, index) => {
      const next = times[index + 1];
      if (
        next !== undefined &&
        next.dayOfWeek === time.dayOfWeek &&
        timesOverlap(time, next)
      ) {
        throw new BadRequestException(
          `Two times off overlap on ${dayName(time.dayOfWeek)}: ${time.startTime} to ${time.endTime} and ${next.startTime} to ${next.endTime}. Make them one time off.`,
        );
      }
    });

    // The classes of the teacher that are in the timetable keep their day and
    // time, so none of them may fall in a time off.
    const placed = await this.prisma.classComponent.findMany({
      where: {
        assignedProfessorId: id,
        dayOfWeek: { not: null },
        startTime: { not: null },
        endTime: { not: null },
      },
      include: {
        courseOffering: { include: { course: true, cohort: true } },
      },
    });
    const clashes: string[] = [];
    for (const cls of placed) {
      const { dayOfWeek, startTime, endTime } = cls;
      if (dayOfWeek === null || startTime === null || endTime === null) {
        continue;
      }
      const off = times.find(
        (time) =>
          time.dayOfWeek === dayOfWeek &&
          timesOverlap(time, { startTime, endTime }),
      );
      if (off !== undefined) {
        clashes.push(
          `${professor.name} teaches ${cls.courseOffering.course.code} ${cls.type} for ${cls.courseOffering.cohort.name} on ${dayName(dayOfWeek)} from ${startTime} to ${endTime}, during the time off ${timeOffText(off)}.`,
        );
      }
    }
    if (clashes.length > 0) {
      const advice =
        clashes.length === 1
          ? 'Choose another teacher for that class on the Course Offerings page, or clear the timetable of its term on the home page, first.'
          : 'Choose another teacher for those classes on the Course Offerings page, or clear the timetable of their terms on the home page, first.';
      throw new ConflictException(`${clashes.join(' ')} ${advice}`);
    }

    // The new list replaces the old one, in one transaction: all or nothing.
    await this.prisma.$transaction([
      this.prisma.professorUnavailability.deleteMany({
        where: { professorId: id },
      }),
      this.prisma.professorUnavailability.createMany({
        data: times.map((time) => ({
          dayOfWeek: time.dayOfWeek,
          startTime: time.startTime,
          endTime: time.endTime,
          professorId: id,
        })),
      }),
    ]);
    return this.prisma.professor.findUnique({
      where: { id },
      include: {
        unavailability: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    });
  }

  private async findExisting(id: string) {
    const professor = await this.prisma.professor.findUnique({ where: { id } });
    if (professor === null) {
      throw new NotFoundException(TEACHER_NOT_FOUND);
    }
    return professor;
  }
}