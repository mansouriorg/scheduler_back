import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from '../prisma/prisma.service';
import { describeItems } from '../common/describe-items';

const COURSE_NOT_FOUND =
  'This course does not exist any more. Reload the page to see the current list.';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async create(createCourseDto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        code: createCourseDto.code,
        title: createCourseDto.title,
        credits: createCourseDto.credits, // THE FIX: This maps the missing credits field.
        totalHours: createCourseDto.totalHours,
        offeredInTerms: createCourseDto.offeredInTerms,
        // This automatically saves the nested array of components to PostgreSQL.
        componentsTemplate: {
          create: createCourseDto.componentsTemplate,
        },
      },
    });
  }

  async findAll() {
    return this.prisma.course.findMany({
      // We must include the relation so the frontend table can display the components
      include: { componentsTemplate: true },
      orderBy: { code: 'asc' },
    });
  }

  // Changes only the fields that were sent. It refuses a course that does not
  // exist (404), hours that do not add up (400: the hours of the parts must
  // equal the course hours) and a code that another course already has (409).
  // Sent parts (componentsTemplate) replace the old list in one write.
  // Offerings copy the parts into their own classes when they are created, so
  // existing offerings keep their classes; only new offerings use the changed
  // parts.
  async update(id: string, updateCourseDto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { componentsTemplate: true },
    });
    if (course === null) {
      throw new NotFoundException(COURSE_NOT_FOUND);
    }
    const { componentsTemplate, ...fields } = updateCourseDto;
    if (fields.totalHours !== undefined || componentsTemplate !== undefined) {
      const totalHours = fields.totalHours ?? course.totalHours;
      const parts: { totalComponentHours: number }[] =
        componentsTemplate ?? course.componentsTemplate;
      const partHours = parts.reduce(
        (sum, part) => sum + part.totalComponentHours,
        0,
      );
      if (partHours !== totalHours) {
        throw new BadRequestException(
          `The parts add up to ${partHours} hours, but the course has ${totalHours} hours. They must be equal.`,
        );
      }
    }
    if (fields.code !== undefined && fields.code !== course.code) {
      const other = await this.prisma.course.findUnique({
        where: { code: fields.code },
      });
      if (other !== null) {
        throw new ConflictException(
          `Another course already has the code ${fields.code}.`,
        );
      }
    }
    return this.prisma.course.update({
      where: { id },
      data: {
        ...fields,
        ...(componentsTemplate === undefined
          ? {}
          : {
              componentsTemplate: {
                deleteMany: {},
                create: componentsTemplate,
              },
            }),
      },
      include: { componentsTemplate: true },
    });
  }

  // Deletes a course without offerings, together with its parts. Otherwise
  // the delete is refused (409): the database would delete its offerings and
  // their classes along with it.
  async remove(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        offerings: {
          select: {
            term: { select: { name: true } },
            cohort: { select: { name: true } },
          },
          orderBy: { term: { startDate: 'asc' } },
        },
      },
    });
    if (course === null) {
      throw new NotFoundException(COURSE_NOT_FOUND);
    }
    const offerings = course.offerings.map(
      (offering) => `${offering.term.name} for ${offering.cohort.name}`,
    );
    if (offerings.length > 0) {
      const those =
        offerings.length === 1
          ? 'that course offering'
          : 'those course offerings';
      throw new ConflictException(
        `${course.code} has ${describeItems(offerings, 'course offering', 'course offerings')}, so it cannot be deleted. First delete ${those}.`,
      );
    }
    return this.prisma.course.delete({ where: { id } });
  }
}
