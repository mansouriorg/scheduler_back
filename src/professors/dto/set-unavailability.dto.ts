import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  Matches,
  ValidateNested,
} from 'class-validator';
import { DayOfWeek } from 'generated/prisma/enums';

// A time on the grid of the timetable: on the hour or half hour, from 08:00
// to 18:30.
const GRID_TIME = /^(0[89]|1[0-7]):[03]0$|^18:[03]0$/;
const GRID_TIME_RULE = {
  message:
    '$property must be on the hour or half hour, from 08:00 to 18:30 (for example 09:30)',
};

// One time each week when the teacher cannot teach.
export class TimeOffDto {
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @Matches(GRID_TIME, GRID_TIME_RULE)
  startTime: string;

  @Matches(GRID_TIME, GRID_TIME_RULE)
  endTime: string;
}

// PUT /professors/:id/unavailability: all the times off of a teacher, for
// example { "times": [{ "dayOfWeek": "MONDAY", "startTime": "08:00",
// "endTime": "12:00" }] }. They replace the times saved before; an empty
// list means the teacher can teach at any time.
export class SetUnavailabilityDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TimeOffDto)
  times: TimeOffDto[];
}
