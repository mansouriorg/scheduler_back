import { Test, TestingModule } from '@nestjs/testing';
import { CourseOfferingsService } from './course-offerings.service';

describe('CourseOfferingsService', () => {
  let service: CourseOfferingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CourseOfferingsService],
    }).compile();

    service = module.get<CourseOfferingsService>(CourseOfferingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
