import { Injectable } from '@nestjs/common';
import { CreateProfessorDto } from './dto/create-professor.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfessorsService {
  constructor(private prisma: PrismaService) {}

  async create(createProfessorDto: CreateProfessorDto) {
    // Saves the incoming data directly to PostgreSQL
    return this.prisma.professor.create({
      data: createProfessorDto,
    });
  }

  async findAll() {
    // Fetches all professors, alphabetized by name
    return this.prisma.professor.findMany({
      orderBy: { name: 'asc' }
    });
  }
}