import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from './rooms.service';

// Tests for changing and deleting rooms. The database (PrismaService) is a
// stand-in: nothing real is read or written.

const room = {
  id: 'room-1',
  name: 'Lab 304',
  capacity: 30,
  roomType: 'COMPUTER_LAB',
  equipment: ['COMPUTERS', 'PROJECTOR'],
  floorId: 'floor-1',
};

// A class booked in Lab 304, as the service reads it from the database.
function bookedClass(
  code: string,
  type: string,
  students: number,
  requiredEquipment: string[] = [],
) {
  return {
    type,
    requiresRoomType: 'COMPUTER_LAB',
    requiredEquipment,
    courseOffering: {
      course: { code },
      _count: { enrollments: students },
    },
  };
}

type PrismaStandIn = {
  room: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: PrismaStandIn;

  // The room as findUnique returns it, with the classes booked in it.
  const roomWith = (...classComponents: ReturnType<typeof bookedClass>[]) =>
    prisma.room.findUnique.mockResolvedValue({ ...room, classComponents });

  const refusal = (promise: Promise<unknown>) =>
    promise.catch((caught: unknown) => caught);

  beforeEach(async () => {
    prisma = {
      room: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(room),
        delete: jest.fn().mockResolvedValue(room),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RoomsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
  });

  describe('update', () => {
    it('saves only the fields that were sent', async () => {
      roomWith();

      await service.update('room-1', { name: 'Lab 305' });

      expect(prisma.room.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { name: 'Lab 305' },
      });
    });

    it('answers 404, and changes nothing, for a room that does not exist', async () => {
      prisma.room.findUnique.mockResolvedValue(null);

      await expect(
        service.update('gone', { name: 'Lab 305' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.room.update).not.toHaveBeenCalled();
    });

    it('allows a change that the booked classes still fit', async () => {
      roomWith(bookedClass('DEV-101', 'TP', 25, ['COMPUTERS']));

      await service.update('room-1', {
        name: 'Lab 304 B',
        capacity: 25,
        equipment: ['COMPUTERS', 'WHITEBOARD'],
        floorId: 'floor-2',
      });

      expect(prisma.room.update).toHaveBeenCalled();
    });

    it('refuses another room type while classes need this one', async () => {
      roomWith(
        bookedClass('DEV-101', 'TD', 20),
        bookedClass('DEV-101', 'TP', 20),
      );

      const error = await refusal(
        service.update('room-1', { roomType: 'CLASSROOM' }),
      );

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Lab 304 cannot change to type "Classroom": it is booked for 2 classes (DEV-101 TD, DEV-101 TP) that need type "Computer Lab".',
      );
      expect(prisma.room.update).not.toHaveBeenCalled();
    });

    it('refuses fewer seats than a booked class has students', async () => {
      roomWith(
        bookedClass('DEV-101', 'TD', 28),
        bookedClass('DB-201', 'TD', 12),
      );

      const error = await refusal(service.update('room-1', { capacity: 20 }));

      expect((error as ConflictException).message).toBe(
        'Lab 304 cannot have fewer than 28 seats: it is booked for 1 class (DEV-101 TD) with 28 students.',
      );
      expect(prisma.room.update).not.toHaveBeenCalled();
    });

    it('refuses to remove equipment that a booked class needs', async () => {
      roomWith(bookedClass('DEV-101', 'TP', 20, ['COMPUTERS']));

      const error = await refusal(
        service.update('room-1', { equipment: ['WHITEBOARD'] }),
      );

      expect((error as ConflictException).message).toBe(
        'Lab 304 must keep PC Computers: it is booked for 1 class (DEV-101 TP) that needs it.',
      );
      expect(prisma.room.update).not.toHaveBeenCalled();
    });

    it('gives every reason at once', async () => {
      roomWith(
        bookedClass('DEV-101', 'TP', 28, ['COMPUTERS', 'PROJECTOR']),
        bookedClass('DB-201', 'TP', 26, ['PROJECTOR']),
      );

      const error = await refusal(
        service.update('room-1', {
          roomType: 'CLASSROOM',
          capacity: 20,
          equipment: [],
        }),
      );

      expect((error as ConflictException).message).toBe(
        'Lab 304 cannot change to type "Classroom": it is booked for 2 classes (DEV-101 TP, DB-201 TP) that need type "Computer Lab". ' +
          'Lab 304 cannot have fewer than 28 seats: it is booked for 2 classes (DEV-101 TP, DB-201 TP) with up to 28 students. ' +
          'Lab 304 must keep PC Computers and Projector: it is booked for 2 classes (DEV-101 TP, DB-201 TP) that need them.',
      );
    });
  });

  describe('remove', () => {
    it('deletes a room that no class is booked in', async () => {
      roomWith();

      await service.remove('room-1');

      expect(prisma.room.delete).toHaveBeenCalledWith({
        where: { id: 'room-1' },
      });
    });

    it('refuses, and says why, while classes are booked in the room', async () => {
      roomWith(
        bookedClass('DEV-101', 'TD', 20),
        bookedClass('DEV-101', 'TP', 20),
        bookedClass('DB-201', 'TP', 15),
      );

      const error = await refusal(service.remove('room-1'));

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Lab 304 is booked for 3 classes (DEV-101 TD, DEV-101 TP, DB-201 TP) in the timetable, so it cannot be deleted: those classes would lose their room.',
      );
      expect(prisma.room.delete).not.toHaveBeenCalled();
    });

    it('answers 404 for a room that does not exist', async () => {
      prisma.room.findUnique.mockResolvedValue(null);

      await expect(service.remove('gone')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.room.delete).not.toHaveBeenCalled();
    });
  });
});
