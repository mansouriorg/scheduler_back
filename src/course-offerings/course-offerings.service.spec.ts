import { Test, TestingModule } from '@nestjs/testing';
import { CourseOfferingsService } from './course-offerings.service';

describe('CourseOfferingsService', () => {
  let service: CourseOfferingsService;

  beforeEach(async () => {
    // Anything the class needs that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      providers: [CourseOfferingsService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<CourseOfferingsService>(CourseOfferingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
