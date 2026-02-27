import { Test, TestingModule } from '@nestjs/testing';
import { CourseOfferingsController } from './course-offerings.controller';
import { CourseOfferingsService } from './course-offerings.service';

describe('CourseOfferingsController', () => {
  let controller: CourseOfferingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourseOfferingsController],
      providers: [CourseOfferingsService],
    }).compile();

    controller = module.get<CourseOfferingsController>(CourseOfferingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
