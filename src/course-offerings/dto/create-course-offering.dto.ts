import { IsString } from 'class-validator';

export class CreateCourseOfferingDto {
  @IsString() termId: string;
  @IsString() courseId: string;
  @IsString() cohortId: string;
}
