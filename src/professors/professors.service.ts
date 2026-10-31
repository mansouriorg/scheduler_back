import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProfessorDto } from './dto/create-professor.dto';
import { UpdateProfessorDto } from './dto/update-professor.dto';
import { PrismaService } from '../prisma/prisma.service';

const TEACHER_NOT_FOUND =
  'This teacher does not exist any more. Reload the page to see the current list.';

@Injectable()
export class ProfessorsService {
  constructor(private prisma: PrismaService) {}

  async create(createProfessorDto: CreateProfessorDto) {
    // Saves the incoming data directly to PostgreSQL
    return this.prisma.professor.create({
      data: createProfessorDto,
    });
  }

  async findAll() {
    // Fetches all professors, alphabetized by name
    return this.prisma.professor.findMany({
      orderBy: { name: 'asc' }
    });
  }

  // Changes only the fields that were sent; 404 when the teacher does not exist.
  async update(id: string, updateProfessorDto: UpdateProfessorDto) {
    await this.findExisting(id);
    return this.prisma.professor.update({
      where: { id },
      data: updateProfessorDto,
    });
  }

  // Deletes a teacher who has no classes. While classes are assigned to the
  // teacher, the delete is refused (409) so that no class silently loses its
  // teacher. Their unavailable days go with them (onDelete: Cascade).
  async remove(id: string) {
    const professor = await this.prisma.professor.findUnique({
      where: { id },
      include: { _count: { select: { classes: true } } },
    });
    if (professor === null) {
      throw new NotFoundException(TEACHER_NOT_FOUND);
    }
    const classCount = professor._count.classes;
    if (classCount > 0) {
      const classes = classCount === 1 ? '1 class' : `${classCount} classes`;
      const those = classCount === 1 ? 'that class' : 'those classes';
      throw new ConflictException(
        `${professor.name} teaches ${classes}, so this teacher cannot be deleted. Assign ${those} to another teacher first.`,
      );
    }
    return this.prisma.professor.delete({ where: { id } });
  }

  private async findExisting(id: string) {
    const professor = await this.prisma.professor.findUnique({ where: { id } });
    if (professor === null) {
      throw new NotFoundException(TEACHER_NOT_FOUND);
    }
    return professor;
  }
}