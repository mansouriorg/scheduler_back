import { Controller, Delete, Post } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('generate')
  async autoGenerateSchedule() {
    return this.schedulerService.autoGenerate();
  }

  // DELETE /scheduler/timetable takes the room, day and time off every class.
  // The classes themselves stay; the next generation places them again.
  @Delete('timetable')
  clearTimetable() {
    return this.schedulerService.clearTimetable();
  }
}
