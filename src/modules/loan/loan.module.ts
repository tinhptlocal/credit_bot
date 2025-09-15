import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loans, Payments, Users } from 'src/entities';
import { MezonModule } from 'src/shared/mezon/mezon.module';
import { LoanService } from './loan.service';

@Module({
  imports: [TypeOrmModule.forFeature([Loans, Users, Payments]), MezonModule],
  providers: [LoanService],
  exports: [LoanService],
})
export class LoanModule {}
