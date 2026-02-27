import { Test, TestingModule } from '@nestjs/testing';
import { CampusesController } from './campuses.controller';
import { CampusesService } from './campuses.service';

describe('CampusesController', () => {
  let controller: CampusesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampusesController],
      providers: [CampusesService],
    }).compile();

    controller = module.get<CampusesController>(CampusesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
