import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Loans, Payments, Users } from 'src/entities';
import { LoanStatus, PaymentStatus } from 'src/types';
import { Repository } from 'typeorm';
import { formatVND } from '../helper';
import { MezonService } from '../mezon/mezon.service';
import { EMessagePayloadType, EMessageType } from '../mezon/types/mezon.type';

@Injectable()
export class RemiderService {
  constructor(
    @InjectRepository(Payments)
    private readonly paymentRepository: Repository<Payments>,
    @InjectRepository(Loans)
    private readonly loansRepository: Repository<Loans>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    private readonly mezonService: MezonService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendPaymentReminders() {
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const payments = await this.paymentRepository.find({
      where: {
        status: PaymentStatus.PENDING,
        dueDate: sevenDaysFromNow.toISOString().slice(0, 10),
      },
    });

    for (const payment of payments) {
      await this.sendReminder(payment);
    }
  }

  // Check overdue payments (1 day late)
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async sendOverdueReminders() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const overdueDate = yesterday.toISOString().slice(0, 10);

    const overduePayments = await this.paymentRepository.find({
      where: {
        status: PaymentStatus.PENDING,
        dueDate: overdueDate,
      },
    });

    for (const payment of overduePayments) {
      await this.paymentRepository.update(
        { id: payment.id },
        {
          status: PaymentStatus.OVERDUE,
          interestRate: (parseFloat(payment.interestRate) + 2).toString(),
        },
      );
      await this.loansRepository.update(
        { id: payment.loanId },
        { status: LoanStatus.OVERDUE },
      );
      const user = await this.usersRepository.findOne({
        where: { userId: payment.userId },
      });
      if (user && user.creditScore > 0) {
        await this.usersRepository.update(
          { userId: payment.userId },
          { creditScore: user.creditScore - 5 },
        );
      }
      await this.sendOverdueNotice(payment, user?.creditScore ?? 0);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_11AM)
  async rewardOnTimePayments() {
    const today = new Date().toISOString().slice(0, 10);

    const paidPayments = await this.paymentRepository.find({
      where: {
        status: PaymentStatus.PAID,
        paidDate: today,
      },
    });

    for (const payment of paidPayments) {
      const user = await this.usersRepository.findOne({
        where: { userId: payment.userId },
      });
      if (user && user.creditScore < 100) {
        await this.usersRepository.update(
          { userId: payment.userId },
          { creditScore: user.creditScore + 1 },
        );
        await this.sendRewardNotice(payment, user.creditScore + 1);
      }
    }
  }

  private async sendReminder(payment: Payments) {
    const message = `🔔 Nhắc nhở: Bạn còn 7 ngày để thanh toán khoản vay!
- Số tiền cần thanh toán: ${formatVND(Number(payment.amount))}
- Ngày đến hạn: ${new Date(payment.dueDate).toLocaleDateString()}
- Mã khoản vay: ${payment.loanId}

💡 Thanh toán đúng hạn để duy trì điểm tín dụng tốt!`;
    await this.mezonService.sendMessage({
      type: EMessageType.DM,
      payload: {
        clan_id: '0',
        user_id: payment.userId,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: message,
        },
      },
    });
  }

  private async sendOverdueNotice(payment: Payments, creditScore: number) {
    const message = `🚨 Khoản vay của bạn đã quá hạn 1 ngày!
- Số tiền cần thanh toán: ${formatVND(Number(payment.amount))}
- Ngày đến hạn: ${new Date(payment.dueDate).toLocaleDateString()}
- Mã khoản vay: ${payment.loanId}
- Lãi suất đã tăng thêm 2%
- Điểm tín dụng giảm 5 điểm (còn lại: ${creditScore})

⚠️ Vui lòng thanh toán ngay để tránh thêm hình phạt!`;
    await this.mezonService.sendMessage({
      type: EMessageType.DM,
      payload: {
        clan_id: '0',
        user_id: payment.userId,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: message,
        },
      },
    });
  }

  private async sendRewardNotice(payment: Payments, newCreditScore: number) {
    const message = `🎉 Cảm ơn bạn đã thanh toán đúng hạn!
- Khoản vay: ${payment.loanId}
- Điểm tín dụng của bạn đã tăng lên ${newCreditScore} điểm (tối đa 100 điểm).`;
    await this.mezonService.sendMessage({
      type: EMessageType.DM,
      payload: {
        clan_id: '0',
        user_id: payment.userId,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: message,
        },
      },
    });
  }
}
