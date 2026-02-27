import { Controller, Get, Post, Body } from '@nestjs/common';
import { ProfessorsService } from './professors.service';
import { CreateProfessorDto } from './dto/create-professor.dto';

@Controller('professors') // This sets the route to http://localhost:3001/professors
export class ProfessorsController {
  constructor(private readonly professorsService: ProfessorsService) {}

  @Post()
  create(@Body() createProfessorDto: CreateProfessorDto) {
    return this.professorsService.create(createProfessorDto);
  }

  @Get()
  findAll() {
    return this.professorsService.findAll();
  }
}