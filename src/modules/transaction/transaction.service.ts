import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TokenSentEvent } from 'mezon-sdk';
import { Transactions, Users, TransactionLogs } from 'src/entities';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transactions)
    private readonly transactionRepository: Repository<Transactions>,
    @InjectRepository(Users) private readonly userRepository: Repository<Users>,
    @InjectRepository(TransactionLogs)
    private readonly transactionLogsRepository: Repository<TransactionLogs>,
  ) {}

  async createToken(data: TokenSentEvent) {
    const transactionId = data.transaction_id;

    try {
      const check = await this.transactionLogsRepository.findOne({
        where: { transactionId },
      });

      if (check || !data.sender_id) return;

      const userBalance = await this.userRepository.findOne({
        where: { userId: data.sender_id },
      });

      if (!userBalance) {
        await this.userRepository.save(
          this.userRepository.create({
            userId: String(data.sender_id),
            balance: String(data.amount),
            username: data.sender_name,
            creditScore: 0,
          }),
        );

        await this.transactionLogsRepository.save(
          this.transactionLogsRepository.create({
            transactionId,
            amount: String(data.amount),
            userId: data.sender_id,
          }),
        );
      } else {
        await this.userRepository.increment(
          { userId: data.sender_id },
          'balance',
          Number(data.amount),
        );

        const newLogs = this.transactionLogsRepository.create({
          transactionId,
          amount: String(data.amount),
          userId: data.sender_id,
        });

        await this.transactionLogsRepository.save(newLogs);
      }
    } catch (error) {
      console.log(error);
    }
  }
}
