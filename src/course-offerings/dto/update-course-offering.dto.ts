import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseOfferingDto } from './create-course-offering.dto';

export class UpdateCourseOfferingDto extends PartialType(CreateCourseOfferingDto) {}
