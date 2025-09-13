import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { MezonModule } from '../mezon/mezon.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loans, Payments, Users } from 'src/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payments, Loans, Users]),
    ScheduleModule.forRoot(),
    MezonModule,
  ],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule {}
