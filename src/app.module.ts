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
import { RemiderModule } from './shared/schedule/remider.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useClass: PostgresConfiguration,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RemiderModule,
    RedisModule,
    EventEmitterModule.forRoot(),
    BotModule,
    UserModule,
    AdminModule,
    BotEventModule,
    TransactionModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
