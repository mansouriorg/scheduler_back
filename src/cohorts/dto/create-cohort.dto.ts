import { IsString, IsNumber, Min, IsEnum } from 'class-validator';
import { TermType } from 'generated/prisma/enums';

export class CreateCohortDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  headcount: number;

  @IsEnum(TermType)
  currentSemester: TermType;
}