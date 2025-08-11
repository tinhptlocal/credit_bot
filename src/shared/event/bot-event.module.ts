import { Module } from '@nestjs/common';
import { UserModule } from 'src/modules/user/user.module';
import { BotEvent } from './bot.event';

@Module({
  imports: [UserModule],
  providers: [BotEvent],
  exports: [BotEvent],
})
export class BotEventModule {}
