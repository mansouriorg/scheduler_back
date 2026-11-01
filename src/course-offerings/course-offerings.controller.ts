import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CourseOfferingsService } from './course-offerings.service';
import { CreateCourseOfferingDto } from './dto/create-course-offering.dto';
import { UpdateCourseOfferingDto } from './dto/update-course-offering.dto';
import { AssignTeachersDto } from './dto/assign-teachers.dto';

@Controller('course-offerings')
export class CourseOfferingsController {
  constructor(
    private readonly courseOfferingsService: CourseOfferingsService,
  ) {}

  @Post()
  create(@Body() createCourseOfferingDto: CreateCourseOfferingDto) {
    return this.courseOfferingsService.create(createCourseOfferingDto);
  }

  @Get()
  findAll() {
    return this.courseOfferingsService.findAll();
  }

  // PATCH /course-offerings/:id moves an offering to another term or cohort.
  // Its course cannot change.
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCourseOfferingDto: UpdateCourseOfferingDto,
  ) {
    return this.courseOfferingsService.update(id, updateCourseOfferingDto);
  }

  // PATCH /course-offerings/:id/teachers sets the teacher of some of its
  // classes, all together or none; refused (409) when a teacher has no time.
  @Patch(':id/teachers')
  assignTeachers(
    @Param('id') id: string,
    @Body() assignTeachersDto: AssignTeachersDto,
  ) {
    return this.courseOfferingsService.assignTeachers(id, assignTeachersDto);
  }

  // DELETE /course-offerings/:id deletes an offering with its classes; it is
  // refused (409) while students are enrolled.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.courseOfferingsService.remove(id);
  }
}
