import { Module } from '@nestjs/common';
import { CourseOfferingsService } from './course-offerings.service';
import { CourseOfferingsController } from './course-offerings.controller';

@Module({
  controllers: [CourseOfferingsController],
  providers: [CourseOfferingsService],
})
export class CourseOfferingsModule {}
