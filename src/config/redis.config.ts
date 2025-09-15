import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const redisClientFactory: FactoryProvider<Redis> = {
  provide: 'RedisClient',
  useFactory: (configService: ConfigService) => {
    const redisInstance = new Redis({
      host: configService.get<string>('REDIS.HOST') as string,
      port: configService.get<number>('REDIS.PORT') as number,
      maxRetriesPerRequest: null,
    });

    redisInstance.on('error', (e) => {
      console.error(`Redis connection error: ${e.message}`);
    });

    return redisInstance;
  },
  inject: [ConfigService],
};
