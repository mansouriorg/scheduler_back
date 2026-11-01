import {
  IsString,
  IsNumber,
  Min,
  IsEnum,
  IsArray,
  IsOptional,
} from 'class-validator';
import { RoomType, Equipment } from 'generated/prisma/enums';

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  capacity: number;

  @IsEnum(RoomType)
  roomType: RoomType;

  @IsArray()
  @IsEnum(Equipment, { each: true })
  @IsOptional()
  equipment: Equipment[];

  @IsString()
  floorId: string;
}
