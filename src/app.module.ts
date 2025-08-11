import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresConfiguration } from './config';
import { BotModule } from './shared/bot/bot.module';
import { RedisModule } from './shared/redis/redis.module';
import { UserModule } from './modules/user/user.module';
import { BotEvent } from './shared/event/bot.event';
import { BotEventModule } from './shared/event/bot-event.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useClass: PostgresConfiguration,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule,
    EventEmitterModule.forRoot(),
    BotModule,
    UserModule,
    BotEventModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
