import { Injectable } from '@nestjs/common';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CohortsService {
  constructor(private prisma: PrismaService) {}

  async create(createCohortDto: CreateCohortDto) {
    return this.prisma.cohort.create({
      data: createCohortDto,
    });
  }

  async findAll() {
    return this.prisma.cohort.findMany({
      orderBy: { name: 'asc' }
    });
  }
}