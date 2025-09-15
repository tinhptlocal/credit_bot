import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ChannelMessage,
  EButtonMessageStyle,
  EMessageComponentType,
} from 'mezon-sdk';
import { MAX_LOAN_AMOUNTS } from 'src/constant';
import { Loans, Roles, UserRoles, Users } from 'src/entities';
import { formatVND } from 'src/shared/helper';
import { MezonService } from 'src/shared/mezon/mezon.service';
import {
  EMessagePayloadType,
  EMessageType,
  MessageButtonClickedEvent,
} from 'src/shared/mezon/types/mezon.type';
import { LoanStatus, PaymentStatus } from 'src/types';
import { ButtonKey } from 'src/types/helper.type';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class LoanService {
  constructor(
    @InjectRepository(Loans)
    private readonly loansRepository: Repository<Loans>,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    private mezonService: MezonService,
    private dataSource: DataSource,
  ) {}

  private tempLoans = new Map<
    string,
    {
      userId: string;
      username: string;
      amount: string;
      interestRate: number;
      term: number;
      messageId: string;
    }
  >();

  createButtonUserClick() {
    return [
      {
        components: [
          {
            id: ButtonKey.ACCEPT,
            type: EMessageComponentType.BUTTON,
            component: { label: 'OK', style: EButtonMessageStyle.PRIMARY },
          },
          {
            id: ButtonKey.CANCEL,
            type: EMessageComponentType.BUTTON,
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      termDetails.baseRate,
    );

    const loanDetails = this.calculateEMI(amount, finalRate, term);

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

    const messageResponse = await this.mezonService.sendMessage({
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

    this.tempLoans.set(messageResponse.message_id, {
      userId: String(userId),
      username: data.username || '',
      amount: String(amount),
      interestRate: finalRate,
      term,
      messageId: messageResponse.message_id,
    });

    return {};
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

  async getLoanActive(data: ChannelMessage) {
    const userId = data.sender_id;

    try {
      const activeLoans = await this.loansRepository.find({
        where: { status: LoanStatus.APPROVED, userId },
        relations: ['user', 'payments'],
        order: { startDate: 'DESC' },
      });

      if (!activeLoans.length) {
        await this.mezonService.sendMessage({
          type: EMessageType.CHANNEL,
          reply_to_message_id: data.message_id,
          payload: {
            channel_id: data.channel_id,
            message: {
              type: EMessagePayloadType.SYSTEM,
              content:
                '📋 **Danh sách khoản vay**\n\nBạn không có khoản vay nào đang hoạt động.',
            },
          },
        });
        return;
      }

      let message = '🏦 **Danh sách khoản vay đang hoạt động**\n\n';

      activeLoans.forEach((loan, index) => {
        message += `${index + 1}. **Khoản vay #${loan.id}**\n`;
        message += `   🆔 **Loan ID: ${loan.id}**\n`;
        message += `   💰 Số tiền: ${loan.amount} VND\n`;
        message += `   📅 Ngày vay: ${loan.startDate.toLocaleDateString()}\n`;
        message += `   ⏳ Kỳ hạn: ${loan.term} tháng\n`;
        message += `   📊 Trạng thái: ${loan.status}\n`;

        const pendingPayments =
          loan.payments?.filter(
            (p) =>
              p.status === PaymentStatus.PENDING ||
              p.status === PaymentStatus.OVERDUE,
          ) || [];

        if (pendingPayments.length > 0) {
          message += `   💳 **Thanh toán cần trả:**\n`;
          pendingPayments.slice(0, 3).forEach((payment, payIndex) => {
            message += `      ${payIndex + 1}. Payment ID: \`${payment.id}\` - ${payment.amount} VND - Hạn: ${new Date(payment.dueDate).toLocaleDateString()}\n`;
            message += `         ▶️ Lệnh: \`$tt ${payment.id} ${payment.amount}\`\n`;
          });
          if (pendingPayments.length > 3) {
            message += `      ... và ${pendingPayments.length - 3} thanh toán khác\n`;
          }
        }

        // Tính toán số tiền thanh toán trước hạn
        const earlyPayment = this.calculateEarlyPaymentAmount(loan);

        message += `   💰 **Thanh toán trước hạn:**\n`;
        message += `      • Tổng cần trả: ${formatVND(earlyPayment.totalAmount)}\n`;
        message += `      • Lãi tiết kiệm: ${formatVND(earlyPayment.interestSaved)}\n`;
        message += `      • Lệnh: \`$tth ${loan.id}\`\n\n`;
      });

      message += '💡 **Gợi ý:**\n';
      message +=
        '• Copy chính xác Payment ID để thanh toán: `$tt <payment_id> <số_tiền>`\n';
      message += '• Sử dụng `$tth <loan_id>` để thanh toán trước hạn toàn bộ\n';
      message += '• Thanh toán trước hạn sẽ tiết kiệm lãi suất\n';
      message += '• Tăng điểm tín dụng của bạn';

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
    } catch (error) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: '❌ Lỗi khi lấy danh sách khoản vay.',
          },
        },
      });
    }
  }

  async getPaymentSchedule(data: ChannelMessage, username?: string) {
    if (username) {
      const user = await this.userRepository.findOne({
        where: { username },
      });

      if (!user) {
        await this.mezonService.sendMessage({
          type: EMessageType.CHANNEL,
          reply_to_message_id: data.message_id,
          payload: {
            channel_id: data.channel_id,
            message: {
              type: EMessagePayloadType.SYSTEM,
              content: `❌ Không tìm thấy user: ${username}`,
            },
          },
        });
        return;
      }

      // Get loan for specified user
      const activeLoan = await this.loansRepository.findOne({
        where: {
          userId: user.userId,
          status: LoanStatus.APPROVED,
        },
        relations: ['payments'],
        order: { startDate: 'DESC' },
      });

      if (!activeLoan) {
        await this.mezonService.sendMessage({
          type: EMessageType.CHANNEL,
          reply_to_message_id: data.message_id,
          payload: {
            channel_id: data.channel_id,
            message: {
              type: EMessagePayloadType.SYSTEM,
              content: `❌ User ${username} không có khoản vay đang hoạt động!`,
            },
          },
        });
        return;
      }

      await this.sendPaymentSchedule(data, activeLoan, username);
    } else {
      const activeLoan = await this.loansRepository.findOne({
        where: {
          userId: data.sender_id,
          status: LoanStatus.APPROVED,
        },
        relations: ['payments'],
        order: { startDate: 'DESC' },
      });

      if (!activeLoan) {
        await this.mezonService.sendMessage({
          type: EMessageType.CHANNEL,
          reply_to_message_id: data.message_id,
          payload: {
            channel_id: data.channel_id,
            message: {
              type: EMessagePayloadType.SYSTEM,
              content: '❌ Bạn không có khoản vay đang hoạt động nào!',
            },
          },
        });
        return;
      }

      await this.sendPaymentSchedule(data, activeLoan);
    }
  }

  private async sendPaymentSchedule(
    data: ChannelMessage,
    loan: Loans,
    username?: string,
  ) {
    const sortedPayments = loan.payments.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    const totalPaid = sortedPayments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const scheduleMessage = sortedPayments
      .map((payment, index) => {
        const dueDate = new Date(payment.dueDate).toLocaleDateString();
        const statusEmoji = {
          [PaymentStatus.PAID]: '✅',
          [PaymentStatus.PENDING]: '⏳',
          [PaymentStatus.OVERDUE]: '❌',
          [PaymentStatus.MINIMUM_PAID]: '⚠️',
        };

        return `${statusEmoji[payment.status]} Kỳ ${index + 1} - ${dueDate}:
\t💰 Số tiền: ${formatVND(Number(payment.amount))}
\t💳 Tối thiểu: ${formatVND(Number(payment.minimumAmount))}
\t📊 Trạng thái: ${payment.status.toUpperCase()}${
          payment.paidDate
            ? `\n\t📅 Ngày thanh toán: ${new Date(payment.paidDate).toLocaleDateString()}`
            : ''
        }`;
      })
      .join('\n\n');

    const message = `📋 Lịch trả nợ khoản vay #${loan.id}${username ? ` của ${username}` : ''}:
💵 Số tiền vay: ${formatVND(Number(loan.amount))}
💰 Đã trả: ${formatVND(totalPaid)}
⚖️ Còn lại: ${formatVND(Number(loan.amount) - totalPaid)}
📅 Ngày vay: ${loan.startDate.toLocaleDateString()}
⏳ Kỳ hạn: ${loan.term} tháng
💫 Lãi suất: ${loan.interstRate}%/năm

${scheduleMessage}

📝 Chú thích:
✅ Đã thanh toán
⏳ Chờ thanh toán
❌ Quá hạn
⚠️ Thanh toán tối thiểu`;

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
  }

  async handleAcceptLoanByUser(data: MessageButtonClickedEvent) {
    const tempLoan = this.tempLoans.get(data.message_id);

    if (!tempLoan) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: '❌ Không tìm thấy thông tin khoản vay hoặc đã hết hạn!',
          },
        },
      });
      return;
    }

    const loan = await this.loansRepository.save(
      this.loansRepository.create({
        userId: tempLoan.userId,
        amount: tempLoan.amount,
        interstRate: tempLoan.interestRate,
        term: tempLoan.term,
        status: LoanStatus.PENDING,
        startDate: new Date(),
        endDate: new Date(
          Date.now() + tempLoan.term * 30 * 24 * 60 * 60 * 1000,
        ),
        timestamp: {
          createdById: tempLoan.userId,
        },
      }),
    );

    this.tempLoans.delete(data.message_id);

    await this.mezonService.updateMessage({
      channel_id: data.channel_id,
      message_id: data.message_id,
      content: {
        type: EMessagePayloadType.OPTIONAL,
        content: {
          t: '✅ Bạn đã xác nhận khoản vay, vui lòng chờ admin duyệt khoản vay của bạn!',
        },
      },
    });

    const adminIds = await this.getAdminUserIds();

    for (const adminId of adminIds) {
      await this.mezonService.sendMessage({
        type: EMessageType.DM,
        payload: {
          clan_id: '0',
          user_id: adminId,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: `🔔 Có yêu cầu vay mới cần duyệt:
- User ID: ${tempLoan.userId}
- User Name: ${tempLoan.username}
- Số tiền: ${formatVND(Number(tempLoan.amount))}
- Kỳ hạn: ${tempLoan.term} tháng
- Lãi suất: ${tempLoan.interestRate}%/năm
- Loan ID: ${loan.id}

Sử dụng lệnh $admin approve ${loan.id} để duyệt khoản vay,
Sử dụng lệnh $admin reject ${loan.id} <reason> để từ chối khoản vay`,
          },
        },
      });
    }
  }

  async getAdminUserIds(): Promise<string[]> {
    const result = await this.dataSource
      .getRepository(UserRoles)
      .createQueryBuilder('ur')
      .select('ur.userId', 'userId')
      .innerJoin(Roles, 'r', 'ur.roleId = r.id')
      .where('r.name = :roleName', { roleName: 'admin' })
      .getRawMany();

    return result.map((row) => row.userId);
  }

  async handleLoanApproval(loanId: string, adminId: string) {
    const loan = await this.loansRepository.findOne({
      where: { id: loanId },
      relations: ['user'],
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    await this.mezonService.sendMessage({
      type: EMessageType.DM,
      payload: {
        clan_id: '0',
        user_id: loan.userId,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: `✅ Khoản vay của bạn đã được duyệt:
- Số tiền vay: ${formatVND(Number(loan.amount))}
- Kỳ hạn: ${loan.term} tháng
- Lãi suất: ${loan.interstRate}%/năm
- Loan ID: ${loan.id}

💡 Hệ thống sẽ nhắc nhở bạn khi đến hạn thanh toán.
⚠️ Thanh toán đúng hạn để duy trì điểm tín dụng tốt!`,
        },
      },
    });
  }

  async handleLoanRejection(loanId: string, adminId: string, reason: string) {
    const loan = await this.loansRepository.findOne({
      where: { id: loanId },
      relations: ['user'],
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    loan.status = LoanStatus.REJECTED;
    await this.loansRepository.save(loan);

    await this.mezonService.sendMessage({
      type: EMessageType.DM,
      payload: {
        clan_id: '0',
        user_id: loan.userId,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: `❌ Khoản vay của bạn đã bị từ chối:
- Số tiền vay: ${formatVND(Number(loan.amount))}
- Kỳ hạn: ${loan.term} tháng
- Loan ID: ${loan.id}
${reason ? `\n📝 Lý do: ${reason}` : ''}

💡 Bạn có thể tạo yêu cầu vay mới với số tiền hoặc kỳ hạn khác.`,
        },
      },
    });
  }

  async handleCancelLoanByUser(data: MessageButtonClickedEvent) {
    this.tempLoans.delete(data.message_id);

    return this.mezonService.updateMessage({
      channel_id: data.channel_id,
      message_id: data.message_id,
      content: {
        type: EMessagePayloadType.OPTIONAL,
        content: {
          t: '❌ Bạn đã hủy yêu cầu vay tiền!',
        },
      },
    });
  }

  /**
   * Tính toán số tiền cần thanh toán trước hạn cho một loan
   */
  private calculateEarlyPaymentAmount(loan: Loans): {
    totalAmount: number;
    principalRemaining: number;
    interestSaved: number;
  } {
    // Lấy các payments đã thanh toán
    const paidPayments =
      loan.payments?.filter(
        (p) =>
          p.status === PaymentStatus.PAID ||
          p.status === PaymentStatus.MINIMUM_PAID,
      ) || [];

    // Lấy các payments chưa thanh toán
    const unpaidPayments =
      loan.payments?.filter(
        (p) =>
          p.status === PaymentStatus.PENDING ||
          p.status === PaymentStatus.OVERDUE,
      ) || [];

    // Tính số tiền gốc đã trả (ước tính 70% là gốc, 30% là lãi)
    const principalPaid = paidPayments.reduce((sum, payment) => {
      const paymentAmount = parseFloat(payment.amount);
      const estimatedPrincipal = paymentAmount * 0.7;
      return sum + estimatedPrincipal;
    }, 0);

    // Tính số tiền gốc còn lại
    const loanPrincipal = parseFloat(loan.amount);
    const principalRemaining = Math.max(0, loanPrincipal - principalPaid);

    // Tính tổng tiền phải trả theo lịch (chưa thanh toán)
    const remainingScheduledAmount = unpaidPayments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount) + parseFloat(payment.fee || '0');
    }, 0);

    // Lãi tiết kiệm được (20% số tiền còn lại)
    const interestSaved = remainingScheduledAmount * 0.2;

    // Tổng tiền cần thanh toán = Số tiền theo lịch - Lãi tiết kiệm
    const totalAmount = Math.max(0, remainingScheduledAmount - interestSaved);

    return {
      totalAmount,
      principalRemaining,
      interestSaved,
    };
  }

  async handleCLickButton(data: MessageButtonClickedEvent) {
    switch (data.button_id) {
      case ButtonKey.ACCEPT.toString():
        return this.handleAcceptLoanByUser(data);
      case ButtonKey.CANCEL.toString():
        return this.handleCancelLoanByUser(data);
      default:
        return;
    }
  }
}
