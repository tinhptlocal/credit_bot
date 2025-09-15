import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const redisClientFactory: FactoryProvider<Redis> = {
  provide: 'RedisClient',
  useFactory: (configService: ConfigService) => {
    const redisUrl = configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      throw new Error('REDIS_URL is not defined in environment variables');
    }

    const redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    redisInstance.on('connect', () => {
      console.log('✅ Connected to Redis successfully');
    });

    redisInstance.on('error', (e) => {
      console.error(`❌ Redis connection error: ${e.message}`);
    });

    return redisInstance;
  },
  inject: [ConfigService],
};
