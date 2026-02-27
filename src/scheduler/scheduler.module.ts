import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service'; // Make sure this path matches!

@Module({
  imports: [HttpModule], // Allows us to talk to Python
  controllers: [SchedulerController],
  providers: [SchedulerService, PrismaService],
})
export class SchedulerModule {}