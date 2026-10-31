import { Test, TestingModule } from '@nestjs/testing';
import { TermsController } from './terms.controller';
import { TermsService } from './terms.service';

describe('TermsController', () => {
  let controller: TermsController;

  beforeEach(async () => {
    // Anything the classes need that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TermsController],
      providers: [TermsService],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<TermsController>(TermsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
