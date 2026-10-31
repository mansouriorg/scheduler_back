import { Test, TestingModule } from '@nestjs/testing';
import { ProfessorsController } from './professors.controller';
import { ProfessorsService } from './professors.service';

describe('ProfessorsController', () => {
  let controller: ProfessorsController;

  beforeEach(async () => {
    // Anything the classes need that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfessorsController],
      providers: [ProfessorsService],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<ProfessorsController>(ProfessorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
