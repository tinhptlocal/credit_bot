import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users, TransactionLogs } from 'src/entities';
import { MezonModule } from 'src/shared/mezon/mezon.module';
import { RedisModule } from 'src/shared/redis/redis.module';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users, TransactionLogs]),
    MezonModule,
    RedisModule,
  ],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
