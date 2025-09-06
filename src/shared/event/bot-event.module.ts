import { Module } from '@nestjs/common';
import { UserModule } from 'src/modules/user/user.module';
import { BotEvent } from './bot.event';
import { TransactionModule } from 'src/modules/transaction/transaction.module';

@Module({
  imports: [UserModule, TransactionModule],
  providers: [BotEvent],
  exports: [BotEvent],
})
export class BotEventModule {}
