import { Module } from '@nestjs/common';
import { UserModule } from 'src/modules/user/user.module';
import { BotEvent } from './bot.event';
import { TransactionModule } from 'src/modules/transaction/transaction.module';
import { LoanModule } from 'src/modules/loan/loan.module';
import { MezonModule } from '../mezon/mezon.module';

@Module({
  imports: [UserModule, TransactionModule, LoanModule, MezonModule],
  providers: [BotEvent],
  exports: [BotEvent],
})
export class BotEventModule {}
