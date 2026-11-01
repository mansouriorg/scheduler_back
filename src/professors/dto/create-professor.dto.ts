import { IsString, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { TimePreference } from 'generated/prisma/enums';
export class CreateProfessorDto {
  @IsString()
  name: string;

  @IsString()
  department: string;

  @IsNumber()
  @Min(1)
  @Max(60)
  maxHoursPerWeek: number;

  @IsEnum(TimePreference)
  timePreference: TimePreference;
}
