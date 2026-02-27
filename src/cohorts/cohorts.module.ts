import { Module } from '@nestjs/common';
import { CohortsService } from './cohorts.service';
import { CohortsController } from './cohorts.controller';

@Module({
  controllers: [CohortsController],
  providers: [CohortsService],
})
export class CohortsModule {}
