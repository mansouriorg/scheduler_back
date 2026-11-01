import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BuildingsService } from './buildings.service';

// Tests for changing and deleting buildings. The database (PrismaService) is a
// stand-in: nothing real is read or written.

const building = {
  id: 'building-1',
  name: 'Science Hub',
  code: 'SCI',
  campusId: 'campus-1',
};

type PrismaStandIn = {
  building: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

describe('BuildingsService', () => {
  let service: BuildingsService;
  let prisma: PrismaStandIn;

  beforeEach(async () => {
    prisma = {
      building: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(building),
        delete: jest.fn().mockResolvedValue(building),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BuildingsService>(BuildingsService);
  });

  it('changes a building, including moving it to another campus', async () => {
    prisma.building.findUnique.mockResolvedValue(building);

    await service.update('building-1', { code: 'SH', campusId: 'campus-2' });

    expect(prisma.building.update).toHaveBeenCalledWith({
      where: { id: 'building-1' },
      data: { code: 'SH', campusId: 'campus-2' },
    });
  });

  it('answers 404, and changes nothing, for a building that does not exist', async () => {
    prisma.building.findUnique.mockResolvedValue(null);

    await expect(
      service.update('gone', { name: 'Library' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.building.update).not.toHaveBeenCalled();
  });

  it('deletes a building without floors', async () => {
    prisma.building.findUnique.mockResolvedValue({ ...building, floors: [] });

    await service.remove('building-1');

    expect(prisma.building.delete).toHaveBeenCalledWith({
      where: { id: 'building-1' },
    });
  });

  it('refuses, and says why, while the building has a floor', async () => {
    prisma.building.findUnique.mockResolvedValue({
      ...building,
      floors: [{ level: 'Ground' }],
    });

    const error: unknown = await service
      .remove('building-1')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(
      'Science Hub has 1 floor (Level Ground), so it cannot be deleted. Delete that floor or move it to another building first.',
    );
    expect(prisma.building.delete).not.toHaveBeenCalled();
  });

  it('answers 404 when deleting a building that does not exist', async () => {
    prisma.building.findUnique.mockResolvedValue(null);

    await expect(service.remove('gone')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.building.delete).not.toHaveBeenCalled();
  });
});
