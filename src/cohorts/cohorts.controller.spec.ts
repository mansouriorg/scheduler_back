import { Test, TestingModule } from '@nestjs/testing';
import { CohortsController } from './cohorts.controller';
import { CohortsService } from './cohorts.service';

describe('CohortsController', () => {
  let controller: CohortsController;

  beforeEach(async () => {
    // Anything the classes need that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CohortsController],
      providers: [CohortsService],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<CohortsController>(CohortsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
