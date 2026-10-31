import { Test, TestingModule } from '@nestjs/testing';
import { CampusesService } from './campuses.service';

describe('CampusesService', () => {
  let service: CampusesService;

  beforeEach(async () => {
    // Anything the class needs that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      providers: [CampusesService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<CampusesService>(CampusesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
