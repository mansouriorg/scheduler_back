import { Test, TestingModule } from '@nestjs/testing';
import { TermsService } from './terms.service';

describe('TermsService', () => {
  let service: TermsService;

  beforeEach(async () => {
    // Anything the class needs that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      providers: [TermsService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<TermsService>(TermsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
