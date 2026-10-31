import { Test, TestingModule } from '@nestjs/testing';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';

describe('BuildingsController', () => {
  let controller: BuildingsController;

  beforeEach(async () => {
    // Anything the classes need that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BuildingsController],
      providers: [BuildingsService],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<BuildingsController>(BuildingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
