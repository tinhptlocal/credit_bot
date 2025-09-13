import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresConfiguration } from './config';
import { BotModule } from './shared/bot/bot.module';
import { RedisModule } from './shared/redis/redis.module';
import { UserModule } from './modules/user/user.module';
import { AdminModule } from './modules/admin/admin.module';
import { BotEventModule } from './shared/event/bot-event.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { ReminderModule } from './shared/schedule/reminder.module';
import { PaymentModule } from './modules/payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useClass: PostgresConfiguration,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ReminderModule,
    RedisModule,
    EventEmitterModule.forRoot(),
    BotModule,
    UserModule,
    AdminModule,
    BotEventModule,
    TransactionModule,
    PaymentModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
