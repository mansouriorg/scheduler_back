import { IsString, IsEnum, IsDateString } from 'class-validator';
import { TermType } from 'generated/prisma/enums';
export class CreateTermDto {
  @IsString()
  name: string;

  @IsEnum(TermType)
  type: TermType;

  // IsDateString ensures the frontend sent a valid ISO-8601 date string
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
