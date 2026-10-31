import { Test, TestingModule } from '@nestjs/testing';
import { CohortsService } from './cohorts.service';

describe('CohortsService', () => {
  let service: CohortsService;

  beforeEach(async () => {
    // Anything the class needs that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      providers: [CohortsService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<CohortsService>(CohortsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
