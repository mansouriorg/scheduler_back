import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCourseOfferingDto } from './dto/create-course-offering.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CourseOfferingsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCourseOfferingDto) {
    // 1. Fetch the Course blueprint to get the components
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: { componentsTemplate: true },
    });

    if (!course) throw new NotFoundException('Course blueprint not found');

    // 2. Create the Offering AND automatically generate the weekly class blocks!
    return this.prisma.courseOffering.create({
      data: {
        termId: dto.termId,
        courseId: dto.courseId,
        cohortId: dto.cohortId,
        // Nested write: Creates the ClassComponents based on the blueprint
        classes: {
          create: course.componentsTemplate.map((template) => ({
            type: template.type,
            durationMinutes: Math.round(template.hoursPerSession * 60), // Convert 1.5 hrs to 90 mins
            requiresRoomType: template.requiresRoomType,
            requiredEquipment: template.requiredEquipment,
            mustFollowType: template.mustFollowType,
            isRecurringWeekly: true, // It's a weekly class schedule block
          })),
        },
      },
      include: { classes: true }, // Returns the generated blocks to the frontend
    });
  }

  async findAll() {
    // Pulls everything so our frontend table looks beautiful
    return this.prisma.courseOffering.findMany({
      include: {
        term: true,
        course: true,
        cohort: true,
        classes: true,
      },
      orderBy: { term: { startDate: 'desc' } },
    });
  }
}