import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { Payments, Loans, Users, Transactions } from 'src/entities';
import { MezonModule } from 'src/shared/mezon/mezon.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payments, Loans, Users, Transactions]),
    MezonModule,
  ],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
