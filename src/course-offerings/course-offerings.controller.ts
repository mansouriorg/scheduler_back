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

  // DELETE /course-offerings/:id deletes an offering with its classes; it is
  // refused (409) while students are enrolled.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.courseOfferingsService.remove(id);
  }
}
