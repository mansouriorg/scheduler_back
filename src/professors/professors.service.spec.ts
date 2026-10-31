import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessorsService } from './professors.service';

// Tests for changing and deleting teachers. The database (PrismaService) is a
// stand-in: nothing real is read or written.

const teacher = {
  id: 'prof-1',
  name: 'Dr. Amal Ben Salah',
  department: 'Computer Science',
  maxHoursPerWeek: 12,
  timePreference: 'MORNING',
  isStrictTimeRequirement: false,
};

type PrismaStandIn = {
  professor: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

describe('ProfessorsService', () => {
  let service: ProfessorsService;
  let prisma: PrismaStandIn;

  beforeEach(async () => {
    prisma = {
      professor: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(teacher),
        delete: jest.fn().mockResolvedValue(teacher),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessorsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProfessorsService>(ProfessorsService);
  });

  describe('update', () => {
    it('saves only the fields that were sent', async () => {
      prisma.professor.findUnique.mockResolvedValue(teacher);

      await service.update('prof-1', { maxHoursPerWeek: 16 });

      expect(prisma.professor.update).toHaveBeenCalledWith({
        where: { id: 'prof-1' },
        data: { maxHoursPerWeek: 16 },
      });
    });

    it('answers 404, and changes nothing, for a teacher that does not exist', async () => {
      prisma.professor.findUnique.mockResolvedValue(null);

      await expect(
        service.update('gone', { name: 'Someone' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.professor.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a teacher who has no classes', async () => {
      prisma.professor.findUnique.mockResolvedValue({
        ...teacher,
        _count: { classes: 0 },
      });

      await service.remove('prof-1');

      expect(prisma.professor.delete).toHaveBeenCalledWith({
        where: { id: 'prof-1' },
      });
    });

    it('refuses, and says why, while the teacher has classes', async () => {
      prisma.professor.findUnique.mockResolvedValue({
        ...teacher,
        _count: { classes: 3 },
      });

      const error: unknown = await service
        .remove('prof-1')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Dr. Amal Ben Salah teaches 3 classes, so this teacher cannot be deleted. Assign those classes to another teacher first.',
      );
      expect(prisma.professor.delete).not.toHaveBeenCalled();
    });

    it('says "1 class" when there is only one', async () => {
      prisma.professor.findUnique.mockResolvedValue({
        ...teacher,
        _count: { classes: 1 },
      });

      const error: unknown = await service
        .remove('prof-1')
        .catch((caught: unknown) => caught);

      expect((error as ConflictException).message).toBe(
        'Dr. Amal Ben Salah teaches 1 class, so this teacher cannot be deleted. Assign that class to another teacher first.',
      );
    });

    it('answers 404 for a teacher that does not exist', async () => {
      prisma.professor.findUnique.mockResolvedValue(null);

      await expect(service.remove('gone')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.professor.delete).not.toHaveBeenCalled();
    });
  });
});
