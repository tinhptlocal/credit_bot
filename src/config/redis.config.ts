import { FactoryProvider } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export const redisClientFactory: FactoryProvider<Redis> = {
  provide: 'RedisClient',
  useFactory: (configService: ConfigService) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const redisInstance = new Redis({
      host: configService.get<string>('REDIS.HOST') as string,
      port: configService.get<number>('REDIS.PORT') as number,
      maxRetriesPerRequest: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    redisInstance.on('error', (e) => {
      console.error(`Redis connection error: ${e.message}`);
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return redisInstance;
  },
  inject: [ConfigService],
};
