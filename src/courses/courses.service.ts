import { Injectable } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async create(createCourseDto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        code: createCourseDto.code,
        title: createCourseDto.title,
        credits: createCourseDto.credits, // 🚨 THE FIX: This maps the missing credits field!
        totalHours: createCourseDto.totalHours,
        offeredInTerms: createCourseDto.offeredInTerms,
        // This automatically saves the nested array of components to PostgreSQL!
        componentsTemplate: {
          create: createCourseDto.componentsTemplate,
        },
      },
    });
  }

  async findAll() {
    return this.prisma.course.findMany({
      // We must include the relation so the frontend table can display the components
      include: { componentsTemplate: true },
      orderBy: { code: 'asc' },
    });
  }
}