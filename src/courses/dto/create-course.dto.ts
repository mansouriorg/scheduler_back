import { IsString, IsNumber, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
// Import your strict Enums from your custom generated Prisma client path!
import { ComponentType, RoomType, Equipment, TermType } from 'generated/prisma/client';

class ComponentTemplateDto {
  @IsEnum(ComponentType)
  type: ComponentType;

  @IsNumber()
  totalComponentHours: number;

  @IsNumber()
  hoursPerSession: number;

  @IsEnum(RoomType)
  requiresRoomType: RoomType;

  @IsArray()
  @IsEnum(Equipment, { each: true })
  requiredEquipment: Equipment[];
}

export class CreateCourseDto {
  @IsString()
  code: string;

  @IsString()
  title: string;

  // 🚨 THE FIX: Adding the credits property so NestJS knows to expect it from the frontend!
  @IsNumber()
  credits: number;

  @IsNumber()
  totalHours: number;

  @IsArray()
  @IsEnum(TermType, { each: true })
  offeredInTerms: TermType[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentTemplateDto)
  componentsTemplate: ComponentTemplateDto[];
}