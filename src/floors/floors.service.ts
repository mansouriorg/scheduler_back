import { Injectable } from '@nestjs/common';
import { CreateFloorDto } from './dto/create-floor.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FloorsService {
  constructor(private prisma: PrismaService) {}

  async create(createFloorDto: CreateFloorDto) {
    return this.prisma.floor.create({ data: createFloorDto });
  }

  async findAll() {
    return this.prisma.floor.findMany({ orderBy: { level: 'asc' } });
  }
}