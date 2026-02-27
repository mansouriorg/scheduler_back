import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CourseOfferingsService } from './course-offerings.service';
import { CreateCourseOfferingDto } from './dto/create-course-offering.dto';
import { UpdateCourseOfferingDto } from './dto/update-course-offering.dto';

@Controller('course-offerings')
export class CourseOfferingsController {
  constructor(private readonly courseOfferingsService: CourseOfferingsService) {}

  @Post()
  create(@Body() createCourseOfferingDto: CreateCourseOfferingDto) {
    return this.courseOfferingsService.create(createCourseOfferingDto);
  }

  @Get()
  findAll() {
    return this.courseOfferingsService.findAll();
  }

}
