import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TermsService } from './terms.service';

// Tests for changing and deleting terms. The database (PrismaService) is a
// stand-in: nothing real is read or written.

const term = {
  id: 'term-1',
  name: 'Fall 2026',
  type: 'SEMESTER_1',
  startDate: new Date('2026-09-14T00:00:00.000Z'),
  endDate: new Date('2027-01-22T00:00:00.000Z'),
};

// An offering of a course in the term, as the service reads it.
const offering = (code: string, cohort: string) => ({
  course: { code },
  cohort: { name: cohort },
});

type PrismaStandIn = {
  term: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

describe('TermsService', () => {
  let service: TermsService;
  let prisma: PrismaStandIn;

  const refusal = (promise: Promise<unknown>) =>
    promise.catch((caught: unknown) => caught);

  beforeEach(async () => {
    prisma = {
      term: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(term),
        delete: jest.fn().mockResolvedValue(term),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TermsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TermsService>(TermsService);
  });

  describe('update', () => {
    it('saves the fields that were sent, with the dates as dates', async () => {
      prisma.term.findUnique.mockResolvedValue(term);

      await service.update('term-1', {
        name: 'Fall 2026/27',
        endDate: '2027-01-29T00:00:00.000Z',
      });

      expect(prisma.term.update).toHaveBeenCalledWith({
        where: { id: 'term-1' },
        data: {
          name: 'Fall 2026/27',
          endDate: new Date('2027-01-29T00:00:00.000Z'),
        },
      });
    });

    it('refuses (400) an end date before the start date that is kept', async () => {
      prisma.term.findUnique.mockResolvedValue(term);

      const error = await refusal(
        service.update('term-1', { endDate: '2026-09-01T00:00:00.000Z' }),
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        'The end date must be after the start date.',
      );
      expect(prisma.term.update).not.toHaveBeenCalled();
    });

    it('answers 404, and changes nothing, for a term that does not exist', async () => {
      prisma.term.findUnique.mockResolvedValue(null);

      await expect(
        service.update('gone', { name: 'Spring 2027' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.term.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a term without course offerings', async () => {
      prisma.term.findUnique.mockResolvedValue({
        ...term,
        courseOfferings: [],
      });

      await service.remove('term-1');

      expect(prisma.term.delete).toHaveBeenCalledWith({
        where: { id: 'term-1' },
      });
    });

    it('refuses, and says why, while the term has course offerings', async () => {
      prisma.term.findUnique.mockResolvedValue({
        ...term,
        courseOfferings: [
          offering('DB-201', 'SE - Year 2'),
          offering('DEV-101', 'SE - Year 1'),
        ],
      });

      const error = await refusal(service.remove('term-1'));

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(
        'Fall 2026 has 2 course offerings (DB-201 for SE - Year 2, DEV-101 for SE - Year 1), so it cannot be deleted. First delete those course offerings.',
      );
      expect(prisma.term.delete).not.toHaveBeenCalled();
    });

    it('answers 404 for a term that does not exist', async () => {
      prisma.term.findUnique.mockResolvedValue(null);

      await expect(service.remove('gone')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.term.delete).not.toHaveBeenCalled();
    });
  });
});
