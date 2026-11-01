import { IsArray, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// One class of the offering and its new teacher. professorId null takes the
// teacher off the class.
export class ClassTeacherDto {
  @IsString()
  classId: string;

  @ValidateIf((_dto: ClassTeacherDto, value: unknown) => value !== null)
  @IsString()
  professorId: string | null;
}

// PATCH /course-offerings/:id/teachers: the classes whose teacher changes,
// for example { "classes": [{ "classId": "...", "professorId": "..." }] }.
export class AssignTeachersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassTeacherDto)
  classes: ClassTeacherDto[];
}
