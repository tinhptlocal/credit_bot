import { Module } from '@nestjs/common';
import { RemiderService } from './remider.service';
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
  providers: [RemiderService],
  exports: [RemiderService],
})
export class RemiderModule {}
