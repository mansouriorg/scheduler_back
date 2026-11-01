import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CampusesService } from './campuses.service';

// Tests for changing and deleting campuses. The database (PrismaService) is a
// stand-in: nothing real is read or written.

const campus = { id: 'campus-1', name: 'North Campus' };

type PrismaStandIn = {
  campus: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

describe('CampusesService', () => {
  let service: CampusesService;
  let prisma: PrismaStandIn;

  beforeEach(async () => {
    prisma = {
      campus: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(campus),
        delete: jest.fn().mockResolvedValue(campus),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampusesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CampusesService>(CampusesService);
  });

  it('renames a campus', async () => {
    prisma.campus.findUnique.mockResolvedValue(campus);

    await service.update('campus-1', { name: 'Main Campus' });

    expect(prisma.campus.update).toHaveBeenCalledWith({
      where: { id: 'campus-1' },
      data: { name: 'Main Campus' },
    });
  });

  it('answers 404, and changes nothing, for a campus that does not exist', async () => {
    prisma.campus.findUnique.mockResolvedValue(null);

    await expect(
      service.update('gone', { name: 'Main Campus' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.campus.update).not.toHaveBeenCalled();
  });

  it('deletes a campus without buildings', async () => {
    prisma.campus.findUnique.mockResolvedValue({ ...campus, buildings: [] });

    await service.remove('campus-1');

    expect(prisma.campus.delete).toHaveBeenCalledWith({
      where: { id: 'campus-1' },
    });
  });

  it('refuses, and says why, while the campus has buildings', async () => {
    prisma.campus.findUnique.mockResolvedValue({
      ...campus,
      buildings: [{ name: 'Library' }, { name: 'Science Hub' }],
    });

    const error: unknown = await service
      .remove('campus-1')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(
      'North Campus has 2 buildings (Library, Science Hub), so it cannot be deleted. Delete those buildings or move them to another campus first.',
    );
    expect(prisma.campus.delete).not.toHaveBeenCalled();
  });

  it('answers 404 when deleting a campus that does not exist', async () => {
    prisma.campus.findUnique.mockResolvedValue(null);

    await expect(service.remove('gone')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.campus.delete).not.toHaveBeenCalled();
  });
});
