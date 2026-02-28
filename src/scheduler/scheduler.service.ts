import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SchedulerService {
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
  ) {}

  async autoGenerate() {
    console.log('🚀 Gathering data for the Python Brain...');
    
    // 1. Fetch resources from PostgreSQL with geographic and unavailability data
    const rooms = await this.prisma.room.findMany({
      include: {
        floor: {
          include: {
            building: true 
          }
        }
      }
    });
    
    // Fetch professors along with their specific days off
    const professors = await this.prisma.professor.findMany({
      include: {
        unavailability: true 
      }
    });
    
    // Fetch ONLY classes that haven't been scheduled yet!
    const classes = await this.prisma.classComponent.findMany({
      where: { startTime: null },
      include: { 
        courseOffering: { 
          include: { 
            course: true,
            cohort: true,
            // Fetch every individual student enrolled in this specific offering
            enrollments: { 
              select: { studentId: true } 
            }
          } 
        } 
      }
    });

    if (classes.length === 0) {
      return { message: 'All classes are already scheduled! Nothing to do.' };
    }

    // 2. Format the payload to perfectly match Python's ultimate Pydantic models
    const payload = {
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        roomType: r.roomType,
        campusId: r.floor.building.campusId, 
        buildingId: r.floor.building.id,      
        equipment: r.equipment || [] 
      })),
      professors: professors.map(p => ({
        id: p.id,
        name: p.name,
        maxHoursPerWeek: p.maxHoursPerWeek,
        timePreference: p.timePreference,
        unavailableDays: p.unavailability?.map(u => u.dayOfWeek) || [] 
      })),
      classes: classes.map(c => ({
        id: c.id,
        courseCode: c.courseOffering.course.code,
        durationMinutes: c.durationMinutes,
        requiresRoomType: c.requiresRoomType,
        requiredEquipment: c.requiredEquipment || [], 
        componentType: c.type,                        
        professorId: c.assignedProfessorId || null,
        cohortId: c.courseOffering.cohortId,
        // Send the ACTUAL physical number of enrolled students!
        cohortHeadcount: c.courseOffering.enrollments.length,
        studentIds: c.courseOffering.enrollments.map(e => e.studentId) 
      }))
    };

    // 3. Send the puzzle to Python!
    try {
      console.log(`🧠 Sending ${payload.classes.length} classes to Python. Checking individual student conflicts...`);
      
      const response = await firstValueFrom(
        // 🚨 WIDENED THE PIPE: 10 minutes (600,000ms) to account for matrix building time!
        this.httpService.post('http://127.0.0.1:8000/solve', payload, { timeout: 0 })
      );

      const result = response.data;

      if (!result.success) {
        throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
      }

      // 4. The puzzle is solved! Save the times and rooms back to PostgreSQL
      console.log('✅ Brain returned a valid schedule. Saving to database...');
      
      let savedCount = 0;
      for (const scheduledClass of result.scheduledClasses) {
        await this.prisma.classComponent.update({
          where: { id: scheduledClass.classId },
          data: {
            assignedRoomId: scheduledClass.roomId,
            dayOfWeek: scheduledClass.dayOfWeek,
            startTime: scheduledClass.startTime,
            endTime: scheduledClass.endTime
          }
        });
        savedCount++;
      }

      return { 
        success: true, 
        message: `Successfully scheduled ${savedCount} classes checking thousands of individual student conflicts!` 
      };

    } catch (error: any) {
      console.error('Brain connection failed:', error?.response?.data || error.message);
      throw new HttpException(
        'Failed to communicate with Python Brain or constraints were impossible.', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}