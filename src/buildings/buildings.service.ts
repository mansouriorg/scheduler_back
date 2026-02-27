import { Injectable } from '@nestjs/common';
import { CreateBuildingDto } from './dto/create-building.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BuildingsService {
  constructor(private prisma: PrismaService) {}

  async create(createBuildingDto: CreateBuildingDto) {
    return this.prisma.building.create({ data: createBuildingDto });
  }

  async findAll() {
    return this.prisma.building.findMany({ orderBy: { name: 'asc' } });
  }
}