import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import {
  Users,
  Roles,
  UserRoles,
  Loans,
  Transactions,
  Payments,
} from 'src/entities';
import { UserModule } from '../user/user.module';
import { MezonModule } from 'src/shared/mezon/mezon.module';
import { LoanModule } from '../loan/loan.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Users,
      Roles,
      UserRoles,
      Loans,
      Transactions,
      Payments,
    ]),
    MezonModule,
    UserModule,
    LoanModule,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
