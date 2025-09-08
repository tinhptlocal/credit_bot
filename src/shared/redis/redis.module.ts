import { Module } from '@nestjs/common';
import { Global } from '@nestjs/common';
import { RedisRepository } from './redis.repository';
import { redisClientFactory } from 'src/config';

@Global()
@Module({
  imports: [],
  providers: [redisClientFactory, RedisRepository],
  exports: [redisClientFactory, RedisRepository],
})
export class RedisModule {}
