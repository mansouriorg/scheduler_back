import { IsString } from 'class-validator';

export class CreateBuildingDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  campusId: string; // Links this building to a parent campus
}