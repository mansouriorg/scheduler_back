import { Test, TestingModule } from '@nestjs/testing';
import { CampusesService } from './campuses.service';

describe('CampusesService', () => {
  let service: CampusesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CampusesService],
    }).compile();

    service = module.get<CampusesService>(CampusesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
