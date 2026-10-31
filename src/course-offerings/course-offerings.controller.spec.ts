import { Test, TestingModule } from '@nestjs/testing';
import { CourseOfferingsController } from './course-offerings.controller';
import { CourseOfferingsService } from './course-offerings.service';

describe('CourseOfferingsController', () => {
  let controller: CourseOfferingsController;

  beforeEach(async () => {
    // Anything the classes need that is not listed here (such as PrismaService)
    // gets an empty stand-in from useMocker, so no database is used.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourseOfferingsController],
      providers: [CourseOfferingsService],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<CourseOfferingsController>(CourseOfferingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
