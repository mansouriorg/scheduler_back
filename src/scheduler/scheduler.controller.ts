import { Body, Controller, Delete, Post, Query } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { GenerateTimetableDto } from './dto/generate-timetable.dto';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  // POST /scheduler/generate with { "termId": "..." } places the classes of
  // that term that are not in the timetable yet.
  @Post('generate')
  async autoGenerateSchedule(
    @Body() generateTimetableDto: GenerateTimetableDto,
  ) {
    return this.schedulerService.autoGenerate(generateTimetableDto.termId);
  }

  // DELETE /scheduler/timetable?termId=... takes the room, day and time off
  // every class of that term (of every term without termId). The classes
  // themselves stay; the next generation places them again.
  @Delete('timetable')
  clearTimetable(@Query('termId') termId?: string) {
    return this.schedulerService.clearTimetable(termId);
  }
}
