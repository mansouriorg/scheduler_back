import { IsString } from 'class-validator';

export class CreateFloorDto {
  @IsString()
  level: string;

  @IsString()
  buildingId: string; // Links this floor to a parent building
}
