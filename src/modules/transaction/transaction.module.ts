import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { Transactions, Users, TransactionLogs } from 'src/entities';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Transactions, TransactionLogs, Users])],
  controllers: [],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
