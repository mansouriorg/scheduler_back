import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
import { PrismaService } from '../prisma/prisma.service';
import { describeItems } from '../common/describe-items';

const CAMPUS_NOT_FOUND =
  'This campus does not exist any more. Reload the page to see the current list.';

@Injectable()
export class CampusesService {
  constructor(private prisma: PrismaService) {}

  async create(createCampusDto: CreateCampusDto) {
    return this.prisma.campus.create({ data: createCampusDto });
  }

  async findAll() {
    return this.prisma.campus.findMany({ orderBy: { name: 'asc' } });
  }

  // Changes only the fields that were sent; 404 when the campus does not exist.
  async update(id: string, updateCampusDto: UpdateCampusDto) {
    const campus = await this.prisma.campus.findUnique({ where: { id } });
    if (campus === null) {
      throw new NotFoundException(CAMPUS_NOT_FOUND);
    }
    return this.prisma.campus.update({ where: { id }, data: updateCampusDto });
  }

  // Deletes a campus without buildings. Otherwise the delete is refused (409):
  // the database would delete its buildings, floors and rooms along with it.
  async remove(id: string) {
    const campus = await this.prisma.campus.findUnique({
      where: { id },
      include: {
        buildings: { select: { name: true }, orderBy: { name: 'asc' } },
      },
    });
    if (campus === null) {
      throw new NotFoundException(CAMPUS_NOT_FOUND);
    }
    const names = campus.buildings.map((building) => building.name);
    if (names.length > 0) {
      const those = names.length === 1 ? 'that building' : 'those buildings';
      const them = names.length === 1 ? 'it' : 'them';
      throw new ConflictException(
        `${campus.name} has ${describeItems(names, 'building', 'buildings')}, so it cannot be deleted. Delete ${those} or move ${them} to another campus first.`,
      );
    }
    return this.prisma.campus.delete({ where: { id } });
  }
}
