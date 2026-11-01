import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { PrismaService } from '../prisma/prisma.service';
import { describeItems } from '../common/describe-items';

const BUILDING_NOT_FOUND =
  'This building does not exist any more. Reload the page to see the current list.';

@Injectable()
export class BuildingsService {
  constructor(private prisma: PrismaService) {}

  async create(createBuildingDto: CreateBuildingDto) {
    return this.prisma.building.create({ data: createBuildingDto });
  }

  async findAll() {
    return this.prisma.building.findMany({ orderBy: { name: 'asc' } });
  }

  // Changes only the fields that were sent (a new campusId moves the building
  // to that campus); 404 when the building does not exist.
  async update(id: string, updateBuildingDto: UpdateBuildingDto) {
    const building = await this.prisma.building.findUnique({ where: { id } });
    if (building === null) {
      throw new NotFoundException(BUILDING_NOT_FOUND);
    }
    return this.prisma.building.update({
      where: { id },
      data: updateBuildingDto,
    });
  }

  // Deletes a building without floors. Otherwise the delete is refused (409):
  // the database would delete its floors and rooms along with it.
  async remove(id: string) {
    const building = await this.prisma.building.findUnique({
      where: { id },
      include: {
        floors: { select: { level: true }, orderBy: { level: 'asc' } },
      },
    });
    if (building === null) {
      throw new NotFoundException(BUILDING_NOT_FOUND);
    }
    const names = building.floors.map((floor) => `Level ${floor.level}`);
    if (names.length > 0) {
      const those = names.length === 1 ? 'that floor' : 'those floors';
      const them = names.length === 1 ? 'it' : 'them';
      throw new ConflictException(
        `${building.name} has ${describeItems(names, 'floor', 'floors')}, so it cannot be deleted. Delete ${those} or move ${them} to another building first.`,
      );
    }
    return this.prisma.building.delete({ where: { id } });
  }
}
