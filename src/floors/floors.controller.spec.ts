import { Test, TestingModule } from '@nestjs/testing';
import { FloorsController } from './floors.controller';
import { FloorsService } from './floors.service';

describe('FloorsController', () => {
  let controller: FloorsController;

  beforeEach(async () => {
    // Anything the classes need that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FloorsController],
      providers: [FloorsService],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<FloorsController>(FloorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
