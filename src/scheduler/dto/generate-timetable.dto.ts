import { IsString } from 'class-validator';

// POST /scheduler/generate: the term whose classes are placed.
export class GenerateTimetableDto {
  @IsString()
  termId: string;
}
