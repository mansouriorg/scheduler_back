import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Equipment, RoomType } from 'generated/prisma/enums';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  EQUIPMENT_NAMES,
  ROOM_TYPE_NAMES,
  classSize,
  joinNames,
} from '../common/room-fit';

const ROOM_NOT_FOUND =
  'This room does not exist any more. Reload the page to see the current list.';

// A class booked in a room, with what it needs from that room.
type BookedClass = {
  type: string;
  requiresRoomType: RoomType;
  requiredEquipment: Equipment[];
  courseOffering: {
    course: { code: string };
    cohort: { headcount: number };
    _count: { enrollments: number };
  };
};

type RoomWithBookedClasses = {
  name: string;
  roomType: RoomType;
  capacity: number;
  equipment: Equipment[];
  classComponents: BookedClass[];
};

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async create(createRoomDto: CreateRoomDto) {
    return this.prisma.room.create({
      data: createRoomDto,
    });
  }

  async findAll() {
    return this.prisma.room.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Changes only the fields that were sent; 404 when the room does not exist.
  // A change is refused (409) when it would leave a class booked in the room
  // without what scheduler-brain booked it for: the room type the class needs,
  // a seat for each of its students (see classSize), and the equipment it
  // needs.
  async update(id: string, updateRoomDto: UpdateRoomDto) {
    const room = await this.findWithBookedClasses(id);
    const reason = whyTheChangeIsRefused(room, updateRoomDto);
    if (reason !== null) {
      throw new ConflictException(reason);
    }
    return this.prisma.room.update({
      where: { id },
      data: updateRoomDto,
    });
  }

  // Deletes a room that no class is booked in. Otherwise the delete is refused
  // (409), because the booked classes would keep their time but lose their room.
  async remove(id: string) {
    const room = await this.findWithBookedClasses(id);
    const booked = room.classComponents;
    if (booked.length > 0) {
      const lose =
        booked.length === 1
          ? 'that class would lose its room'
          : 'those classes would lose their room';
      throw new ConflictException(
        `${room.name} is booked for ${describeClasses(booked)} in the timetable, so it cannot be deleted: ${lose}.`,
      );
    }
    return this.prisma.room.delete({ where: { id } });
  }

  private async findWithBookedClasses(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        classComponents: {
          select: {
            type: true,
            requiresRoomType: true,
            requiredEquipment: true,
            courseOffering: {
              select: {
                course: { select: { code: true } },
                cohort: { select: { headcount: true } },
                _count: { select: { enrollments: true } },
              },
            },
          },
        },
      },
    });
    if (room === null) {
      throw new NotFoundException(ROOM_NOT_FOUND);
    }
    return room;
  }
}

// Says why the change is refused, or returns null when every class booked in
// the room still fits afterwards. Only what the change takes away counts, so a
// new name or floor is never refused.
function whyTheChangeIsRefused(
  room: RoomWithBookedClasses,
  change: UpdateRoomDto,
): string | null {
  const booked = room.classComponents;
  const reasons: string[] = [];

  const roomType = change.roomType ?? room.roomType;
  const needType = booked.filter(
    (c) => c.requiresRoomType === room.roomType && roomType !== room.roomType,
  );
  if (needType.length > 0) {
    reasons.push(
      `${room.name} cannot change to type "${ROOM_TYPE_NAMES[roomType]}": it is booked for ${describeClasses(needType)} that ${need(needType)} type "${ROOM_TYPE_NAMES[room.roomType]}".`,
    );
  }

  const capacity = change.capacity ?? room.capacity;
  const tooBig = booked.filter((c) => {
    const students = studentsOf(c);
    return students <= room.capacity && students > capacity;
  });
  if (tooBig.length > 0) {
    const most = Math.max(...tooBig.map(studentsOf));
    const upTo = tooBig.length === 1 ? '' : 'up to ';
    reasons.push(
      `${room.name} cannot have fewer than ${most} seats: it is booked for ${describeClasses(tooBig)} with ${upTo}${most} students.`,
    );
  }

  const equipment = change.equipment ?? room.equipment;
  const removed = room.equipment.filter(
    (item) => equipment.includes(item) === false,
  );
  const needRemoved = booked.filter((c) =>
    c.requiredEquipment.some((item) => removed.includes(item)),
  );
  if (needRemoved.length > 0) {
    const missing = removed.filter((item) =>
      needRemoved.some((c) => c.requiredEquipment.includes(item)),
    );
    const names = joinNames(missing.map((item) => EQUIPMENT_NAMES[item]));
    const pronoun = missing.length === 1 ? 'it' : 'them';
    reasons.push(
      `${room.name} must keep ${names}: it is booked for ${describeClasses(needRemoved)} that ${need(needRemoved)} ${pronoun}.`,
    );
  }

  return reasons.length > 0 ? reasons.join(' ') : null;
}

// "1 class (DEV-101 TD)" or "3 classes (DEV-101 TD, DEV-101 TP, DB-201 TP)".
function describeClasses(classes: BookedClass[]): string {
  const names = [
    ...new Set(classes.map((c) => `${c.courseOffering.course.code} ${c.type}`)),
  ];
  const shown =
    names.length > 3
      ? `${names.slice(0, 3).join(', ')} and others`
      : names.join(', ');
  const count = classes.length === 1 ? '1 class' : `${classes.length} classes`;
  return `${count} (${shown})`;
}

function need(classes: BookedClass[]): string {
  return classes.length === 1 ? 'needs' : 'need';
}

function studentsOf(c: BookedClass): number {
  return classSize(
    c.courseOffering.cohort.headcount,
    c.courseOffering._count.enrollments,
  );
}
