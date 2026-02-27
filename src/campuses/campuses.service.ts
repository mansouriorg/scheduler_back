import { Injectable } from '@nestjs/common';
import { CreateCampusDto } from './dto/create-campus.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampusesService {
  constructor(private prisma: PrismaService) {}

  async create(createCampusDto: CreateCampusDto) {
    return this.prisma.campus.create({ data: createCampusDto });
  }

  async findAll() {
    return this.prisma.campus.findMany({ orderBy: { name: 'asc' } });
  }
}