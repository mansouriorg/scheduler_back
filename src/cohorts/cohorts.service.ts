import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';
import { PrismaService } from '../prisma/prisma.service';
import { describeItems } from '../common/describe-items';

const COHORT_NOT_FOUND =
  'This cohort does not exist any more. Reload the page to see the current list.';

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
  // Nothing in the timetable depends on the name, headcount or semester of a
  // cohort (scheduler-brain counts the enrolled students), so no change is
  // refused.
  async update(id: string, updateCohortDto: UpdateCohortDto) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id } });
    if (cohort === null) {
      throw new NotFoundException(COHORT_NOT_FOUND);
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
