import { IsString } from 'class-validator';

export class CreateCampusDto {
  @IsString()
  name: string;
}
