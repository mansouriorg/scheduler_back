import { Injectable } from '@nestjs/common';
import { CreateTermDto } from './dto/create-term.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TermsService {
  constructor(private prisma: PrismaService) {}

  async create(createTermDto: CreateTermDto) {
    return this.prisma.term.create({
      data: {
        name: createTermDto.name,
        type: createTermDto.type,
        // Prisma expects true JS Date objects, so we convert the strings here
        startDate: new Date(createTermDto.startDate),
        endDate: new Date(createTermDto.endDate),
      }
    });
  }

  async findAll() {
    return this.prisma.term.findMany({
      orderBy: { startDate: 'desc' } // Puts the newest semesters at the top!
    });
  }
}