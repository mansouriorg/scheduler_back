import { Test, TestingModule } from '@nestjs/testing';
import { FloorsService } from './floors.service';

describe('FloorsService', () => {
  let service: FloorsService;

  beforeEach(async () => {
    // Anything the class needs that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      providers: [FloorsService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<FloorsService>(FloorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
