import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
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

  // PATCH /cohorts/:id changes only the fields that are sent.
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCohortDto: UpdateCohortDto) {
    return this.cohortsService.update(id, updateCohortDto);
  }

  // DELETE /cohorts/:id is refused (409) while the cohort has course
  // offerings or students.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cohortsService.remove(id);
  }
}
