import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ProfessorsService } from './professors.service';
import { CreateProfessorDto } from './dto/create-professor.dto';
import { UpdateProfessorDto } from './dto/update-professor.dto';
import { SetUnavailabilityDto } from './dto/set-unavailability.dto';

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

  // PATCH /professors/:id changes only the fields that are sent.
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProfessorDto: UpdateProfessorDto,
  ) {
    return this.professorsService.update(id, updateProfessorDto);
  }

  // PUT /professors/:id/unavailability replaces the times each week when the
  // teacher cannot teach (400 or 409, with the reason, when they do not fit).
  @Put(':id/unavailability')
  setUnavailability(
    @Param('id') id: string,
    @Body() setUnavailabilityDto: SetUnavailabilityDto,
  ) {
    return this.professorsService.setUnavailability(id, setUnavailabilityDto);
  }

  // DELETE /professors/:id is refused (409) while the teacher has classes.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.professorsService.remove(id);
  }
}