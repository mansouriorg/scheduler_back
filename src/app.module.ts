import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProfessorsModule } from './professors/professors.module';
import { RoomsModule } from './rooms/rooms.module';
import { CohortsModule } from './cohorts/cohorts.module';
import { TermsModule } from './terms/terms.module';
import { CampusesModule } from './campuses/campuses.module';
import { BuildingsModule } from './buildings/buildings.module';
import { FloorsModule } from './floors/floors.module';
import { CourseOfferingsModule } from './course-offerings/course-offerings.module';

@Module({
  imports: [PrismaModule, ProfessorsModule, RoomsModule, CohortsModule, TermsModule, CampusesModule, BuildingsModule, FloorsModule, CourseOfferingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
