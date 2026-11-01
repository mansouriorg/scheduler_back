import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FloorsService } from './floors.service';

// Tests for changing and deleting floors. The database (PrismaService) is a
// stand-in: nothing real is read or written.

const floor = { id: 'floor-1', level: '2', buildingId: 'building-1' };

type PrismaStandIn = {
  floor: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

describe('FloorsService', () => {
  let service: FloorsService;
  let prisma: PrismaStandIn;

  beforeEach(async () => {
    prisma = {
      floor: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(floor),
        delete: jest.fn().mockResolvedValue(floor),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FloorsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<FloorsService>(FloorsService);
  });

  it('changes a floor, including moving it to another building', async () => {
    prisma.floor.findUnique.mockResolvedValue(floor);

    await service.update('floor-1', { level: '3', buildingId: 'building-2' });

    expect(prisma.floor.update).toHaveBeenCalledWith({
      where: { id: 'floor-1' },
      data: { level: '3', buildingId: 'building-2' },
    });
  });

  it('answers 404, and changes nothing, for a floor that does not exist', async () => {
    prisma.floor.findUnique.mockResolvedValue(null);

    await expect(service.update('gone', { level: '3' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.floor.update).not.toHaveBeenCalled();
  });

  it('deletes a floor without rooms', async () => {
    prisma.floor.findUnique.mockResolvedValue({
      ...floor,
      building: { name: 'Science Hub' },
      rooms: [],
    });

    await service.remove('floor-1');

    expect(prisma.floor.delete).toHaveBeenCalledWith({
      where: { id: 'floor-1' },
    });
  });

  it('refuses, and says why, while the floor has rooms', async () => {
    prisma.floor.findUnique.mockResolvedValue({
      ...floor,
      building: { name: 'Science Hub' },
      rooms: [
        { name: 'Amphi A' },
        { name: 'Lab 304' },
        { name: 'Lab 305' },
        { name: 'Room 201' },
      ],
    });

    const error: unknown = await service
      .remove('floor-1')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(
      'Level 2 of Science Hub has 4 rooms (Amphi A, Lab 304, Lab 305 and others), so it cannot be deleted. Delete those rooms or move them to another floor first.',
    );
    expect(prisma.floor.delete).not.toHaveBeenCalled();
  });

  it('answers 404 when deleting a floor that does not exist', async () => {
    prisma.floor.findUnique.mockResolvedValue(null);

    await expect(service.remove('gone')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.floor.delete).not.toHaveBeenCalled();
  });
});
