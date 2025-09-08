import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ChannelMessage, EButtonMessageStyle } from 'mezon-sdk';
import { MAX_LOAN_AMOUNTS } from 'src/constant';
import { Loans, Users } from 'src/entities';
import { formatVND } from 'src/shared/helper';
import { MezonService } from 'src/shared/mezon/mezon.service';
import {
  EMessagePayloadType,
  EMessageType,
} from 'src/shared/mezon/types/mezon.type';
import { LoanStatus, PaymentStatus } from 'src/types';
import { ButtonKey } from 'src/types/helper.type';
import { Repository } from 'typeorm';

@Injectable()
export class LoanService {
  constructor(
    @InjectRepository(Loans)
    private readonly loansRepository: Repository<Loans>,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    private mezonService: MezonService,
  ) {}

  createButtonUserClick() {
    return [
      {
        components: [
          {
            id: ButtonKey.ACCEPT,
            type: EMessagePayloadType.SYSTEM,
            component: { label: 'OK', style: EButtonMessageStyle.PRIMARY },
          },
          {
            id: ButtonKey.CANCEL,
            type: EMessagePayloadType.SYSTEM,
            component: { label: 'Hủy bỏ', style: EButtonMessageStyle.DANGER },
          },
        ],
      },
    ];
  }

  private calculateEMI(
    principal: number,
    annualRate: number,
    termInMonths: number,
  ): {
    monthlyPayment: number;
    totalAmount: number;
    totalInterest: number;
    schedule: Array<{
      month: number;
      payment: number;
      principal: number;
      interest: number;
      remainingBalance: number;
    }>;
  } {
    const monthlyRate = annualRate / 12 / 100;

    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, termInMonths)) /
      (Math.pow(1 + monthlyRate, termInMonths) - 1);

    const totalAmount = monthlyPayment * termInMonths;
    const totalInterest = totalAmount - principal;

    let remainingBalance = principal;
    const schedule: Array<{
      month: number;
      payment: number;
      principal: number;
      interest: number;
      remainingBalance: number;
    }> = [];

    for (let month = 1; month <= termInMonths; month++) {
      const interest = remainingBalance * monthlyRate;
      const principalPaid = monthlyPayment - interest;
      remainingBalance -= principalPaid;

      schedule.push({
        month,
        payment: monthlyPayment,
        principal: principalPaid,
        interest,
        remainingBalance: Math.max(0, remainingBalance),
      });
    }

    return {
      monthlyPayment,
      totalAmount,
      totalInterest,
      schedule,
    };
  }

  private readonly loanTermOptions = {
    3: { baseRate: 12, maxAmount: 300000 }, // 3 months - 12% annual
    6: { baseRate: 15, maxAmount: 500000 }, // 6 months - 15% annual
    9: { baseRate: 18, maxAmount: 750000 }, // 9 months - 18% annual
    12: { baseRate: 20, maxAmount: 1000000 }, // 12 months - 20% annual
  };

  private validateLoanTerm(term: number): boolean {
    return term in this.loanTermOptions;
  }

  private validateLoanAmount(amount: number, term: number): boolean {
    return amount <= this.loanTermOptions[term].maxAmount;
  }

  private getLoanTermDetails(term: number) {
    return this.loanTermOptions[term];
  }

  private calculateInterestRate(creditScore: number, baseRate: number): number {
    if (creditScore >= 80) return baseRate - 2;
    if (creditScore >= 70) return baseRate - 1;
    if (creditScore >= 60) return baseRate;
    if (creditScore >= 50) return baseRate + 1;
    return baseRate + 2;
  }

  async requestLoan(data: ChannelMessage, amount: number, term: number) {
    const userId = data.sender_id;

    const user = await this.userRepository.findOne({
      where: { userId },
    });

    if (!user) {
      await this.userRepository.save(
        this.userRepository.create({
          userId: String(userId),
          balance: '0',
          creditScore: 100,
          username: data.username,
        }),
      );
    }

    const hasExistActiveLoan = await this.loansRepository.exists({
      where: {
        userId,
        status: LoanStatus.APPROVED,
      },
    });

    console.log('object', hasExistActiveLoan);

    if (hasExistActiveLoan) {
      const message =
        '❌ Bạn đang có 1 khoản vay, hãy thanh toán khoản vay đó trước khi muốn vay tiếp!';
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: message,
          },
        },
      });

      return;
    }

    if (amount > MAX_LOAN_AMOUNTS) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              '❌ Bot đang nghèo nên chỉ có thể cho vay dưới 1.000.000 đ thôi :((((',
          },
        },
      });
      return;
    }

    if (term < 1 || term > 12) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              '❌ Thời hạn vay phải từ 1 đến 12 tháng, bạn hãy kiểm tra lại',
          },
        },
      });
      return;
    }

    const termDetails = this.getLoanTermDetails(term);
    const creditScore = user?.creditScore || 100;
    const finalRate = this.calculateInterestRate(
      creditScore,
      termDetails.baseRate,
    );

    const loanDetails = this.calculateEMI(amount, finalRate, term);

    const loan = await this.loansRepository.save(
      this.loansRepository.create({
        userId: String(userId),
        amount: String(amount),
        interstRate: finalRate,
        term,
        status: LoanStatus.PENDING,
        startDate: new Date(),
        endDate: new Date(Date.now() + term * 30 * 24 * 60 * 60 * 1000),
      }),
    );

    const scheduleMessage = loanDetails.schedule
      .map(
        (payment, index) =>
          `\t- Tháng thứ ${payment.month}: ${formatVND(payment.payment)} (Gốc: ${formatVND(payment.principal)}, Lãi: ${formatVND(payment.interest)})`,
      )
      .join('\n');

    const systemMessageText = `✅ Khoản vay của bạn là:
    - Số tiền vay: ${formatVND(amount)}
    - Lãi suất cơ bản: ${termDetails.baseRate}%/năm
    - Lãi suất theo điểm tín dụng: ${finalRate}%/năm
    - Kỳ hạn: ${term} tháng
    - Thanh toán hàng tháng: ${formatVND(loanDetails.monthlyPayment)}
    - Tổng tiền phải trả: ${formatVND(loanDetails.totalAmount)}
    - Tổng tiền lãi: ${formatVND(loanDetails.totalInterest)}
✅ Lịch trả nợ:
${scheduleMessage}
✅ Xác nhận khoản vay của bạn`;

    await this.mezonService.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.OPTIONAL,
          content: {
            t: systemMessageText,
            components: this.createButtonUserClick(),
          },
        },
      },
    });

    return loan;
  }

  async getLoanStatus(data: ChannelMessage) {
    const userId = data.sender_id;
    const user = await this.userRepository.findOne({
      where: { userId },
    });

    if (!user) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: '❌ Không tìm thấy thông tin tài khoản',
          },
        },
      });
      return;
    }

    const loans = await this.loansRepository.find({
      where: { userId },
      relations: ['payments'],
      order: { startDate: 'DESC' },
    });

    if (!loans.length) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: '📝 Bạn chưa có khoản vay nào',
          },
        },
      });
      return;
    }

    const loanStatus = loans
      .map((loan) => {
        const paidPayments = loan.payments.filter(
          (p) => p.status === PaymentStatus.PAID,
        );
        const totalPaid = paidPayments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );

        return `
🔸 Khoản vay: ${formatVND(Number(loan.amount))}
📅 Ngày vay: ${loan.startDate.toLocaleDateString()}
⏳ Thời hạn: ${loan.term} tháng
💰 Đã trả: ${formatVND(totalPaid)}
📊 Trạng thái: ${loan.status}
      `;
      })
      .join('\n---\n');

    await this.mezonService.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: `📊 Thông tin khoản vay:\n${loanStatus}`,
        },
      },
    });
  }
}
