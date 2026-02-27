import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CohortsService } from './cohorts.service';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';

@Controller('cohorts')
export class CohortsController {
  constructor(private readonly cohortsService: CohortsService) {}

  @Post()
  create(@Body() createCohortDto: CreateCohortDto) {
    return this.cohortsService.create(createCohortDto);
  }

  @Get()
  findAll() {
    return this.cohortsService.findAll();
  }


}
