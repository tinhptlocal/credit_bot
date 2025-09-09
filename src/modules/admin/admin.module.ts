import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { Users, Roles, UserRoles, Loans, Transactions, Payments } from 'src/entities';
import { UserModule } from '../user/user.module';
import { MezonModule } from 'src/shared/mezon/mezon.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users, Roles, UserRoles, Loans, Transactions, Payments]),
    UserModule,
    MezonModule,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
