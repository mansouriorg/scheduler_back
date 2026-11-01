import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { PrismaService } from '../prisma/prisma.service';
import { describeItems } from '../common/describe-items';

const FLOOR_NOT_FOUND =
  'This floor does not exist any more. Reload the page to see the current list.';

@Injectable()
export class FloorsService {
  constructor(private prisma: PrismaService) {}

  async create(createFloorDto: CreateFloorDto) {
    return this.prisma.floor.create({ data: createFloorDto });
  }

  async findAll() {
    return this.prisma.floor.findMany({ orderBy: { level: 'asc' } });
  }

  // Changes only the fields that were sent (a new buildingId moves the floor
  // to that building); 404 when the floor does not exist.
  async update(id: string, updateFloorDto: UpdateFloorDto) {
    const floor = await this.prisma.floor.findUnique({ where: { id } });
    if (floor === null) {
      throw new NotFoundException(FLOOR_NOT_FOUND);
    }
    return this.prisma.floor.update({ where: { id }, data: updateFloorDto });
  }

  // Deletes a floor without rooms. Otherwise the delete is refused (409): the
  // database would delete its rooms along with it.
  async remove(id: string) {
    const floor = await this.prisma.floor.findUnique({
      where: { id },
      include: {
        building: { select: { name: true } },
        rooms: { select: { name: true }, orderBy: { name: 'asc' } },
      },
    });
    if (floor === null) {
      throw new NotFoundException(FLOOR_NOT_FOUND);
    }
    const names = floor.rooms.map((room) => room.name);
    if (names.length > 0) {
      const those = names.length === 1 ? 'that room' : 'those rooms';
      const them = names.length === 1 ? 'it' : 'them';
      throw new ConflictException(
        `Level ${floor.level} of ${floor.building.name} has ${describeItems(names, 'room', 'rooms')}, so it cannot be deleted. Delete ${those} or move ${them} to another floor first.`,
      );
    }
    return this.prisma.floor.delete({ where: { id } });
  }
}
