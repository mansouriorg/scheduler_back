import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { PrismaService } from '../prisma/prisma.service';
import { describeItems } from '../common/describe-items';

const TERM_NOT_FOUND =
  'This term does not exist any more. Reload the page to see the current list.';

@Injectable()
export class TermsService {
  constructor(private prisma: PrismaService) {}

  async create(createTermDto: CreateTermDto) {
    return this.prisma.term.create({
      data: {
        name: createTermDto.name,
        type: createTermDto.type,
        // Prisma expects true JS Date objects, so we convert the strings here
        startDate: new Date(createTermDto.startDate),
        endDate: new Date(createTermDto.endDate),
      },
    });
  }

  async findAll() {
    return this.prisma.term.findMany({
      orderBy: { startDate: 'desc' }, // Puts the newest semesters at the top
    });
  }

  // Changes only the fields that were sent; 404 when the term does not exist,
  // 400 when the end date would no longer come after the start date.
  async update(id: string, updateTermDto: UpdateTermDto) {
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (term === null) {
      throw new NotFoundException(TERM_NOT_FOUND);
    }
    const { startDate, endDate, ...rest } = updateTermDto;
    const start =
      startDate === undefined ? term.startDate : new Date(startDate);
    const end = endDate === undefined ? term.endDate : new Date(endDate);
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'The end date must be after the start date.',
      );
    }
    return this.prisma.term.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate === undefined ? {} : { startDate: start }),
        ...(endDate === undefined ? {} : { endDate: end }),
      },
    });
  }

  // Deletes a term without course offerings. Otherwise the delete is refused
  // (409): the database would delete its course offerings and their classes
  // along with it.
  async remove(id: string) {
    const term = await this.prisma.term.findUnique({
      where: { id },
      include: {
        courseOfferings: {
          select: {
            course: { select: { code: true } },
            cohort: { select: { name: true } },
          },
          orderBy: { course: { code: 'asc' } },
        },
      },
    });
    if (term === null) {
      throw new NotFoundException(TERM_NOT_FOUND);
    }
    const offerings = term.courseOfferings.map(
      (offering) => `${offering.course.code} for ${offering.cohort.name}`,
    );
    if (offerings.length > 0) {
      const those =
        offerings.length === 1
          ? 'that course offering'
          : 'those course offerings';
      throw new ConflictException(
        `${term.name} has ${describeItems(offerings, 'course offering', 'course offerings')}, so it cannot be deleted. First delete ${those}.`,
      );
    }
    return this.prisma.term.delete({ where: { id } });
  }
}
