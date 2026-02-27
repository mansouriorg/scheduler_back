import { Test, TestingModule } from '@nestjs/testing';
import { CohortsService } from './cohorts.service';

describe('CohortsService', () => {
  let service: CohortsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CohortsService],
    }).compile();

    service = module.get<CohortsService>(CohortsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
