import { Test, TestingModule } from '@nestjs/testing';
import { CampusesController } from './campuses.controller';
import { CampusesService } from './campuses.service';

describe('CampusesController', () => {
  let controller: CampusesController;

  beforeEach(async () => {
    // Anything the classes need that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampusesController],
      providers: [CampusesService],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<CampusesController>(CampusesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
