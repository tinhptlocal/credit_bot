import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Payments, Loans, Users, Transactions } from 'src/entities';
import { PaymentStatus, LoanStatus, TransactionType } from 'src/types';
import { ChannelMessage } from 'mezon-sdk';
import { MezonService } from 'src/shared/mezon/mezon.service';
import { EMessageType, EMessagePayloadType } from 'src/shared/mezon/types/mezon.type';
import { formatVND } from 'src/shared/helper';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payments)
    private readonly paymentsRepository: Repository<Payments>,
    @InjectRepository(Loans)
    private readonly loansRepository: Repository<Loans>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Transactions)
    private readonly transactionsRepository: Repository<Transactions>,
    private readonly mezonService: MezonService,
  ) {}

  /**
   * Thanh toán trước hạn toàn bộ khoản vay
   */
  async payEarlyFullLoan(data: ChannelMessage, loanId: string): Promise<void> {
    try {
      const userId = data.sender_id;

      // Kiểm tra loan có tồn tại và thuộc về user
      const loan = await this.loansRepository.findOne({
        where: { id: loanId, userId },
        relations: ['payments'],
      });

      if (!loan) {
        await this.sendMessage(data, '❌ Không tìm thấy khoản vay này hoặc bạn không có quyền truy cập.');
        return;
      }

      if (loan.status === LoanStatus.REPAID) {
        await this.sendMessage(data, '✅ Khoản vay này đã được thanh toán đầy đủ rồi.');
        return;
      }

      if (loan.status !== LoanStatus.APPROVED) {
        await this.sendMessage(data, '❌ Chỉ có thể thanh toán trước hạn cho các khoản vay đã được phê duyệt.');
        return;
      }

      // Tính toán tổng số tiền cần thanh toán
      const calculation = await this.calculateEarlyPaymentAmount(loan);

      // Kiểm tra số dư user
      const user = await this.usersRepository.findOne({ where: { userId } });
      if (!user || parseFloat(user.balance) < calculation.totalAmount) {
        await this.sendMessage(data,
          `❌ **Số dư không đủ để thanh toán trước hạn**\n\n` +
          `💰 Cần: ${formatVND(calculation.totalAmount)}\n` +
          `💳 Có: ${formatVND(parseFloat(user?.balance || '0'))}\n` +
          `💸 Thiếu: ${formatVND(calculation.totalAmount - parseFloat(user?.balance || '0'))}`
        );
        return;
      }

      // Hiển thị thông tin và yêu cầu xác nhận
      const confirmMessage = this.formatEarlyPaymentConfirmation(loan, calculation);
      await this.sendMessage(data, confirmMessage);

    } catch (error) {
      this.logger.error('Error in early payment:', error);
      await this.sendMessage(data, '❌ Lỗi khi xử lý thanh toán trước hạn.');
    }
  }

  /**
   * Xác nhận và thực hiện thanh toán trước hạn
   */
  async confirmEarlyPayment(data: ChannelMessage, loanId: string): Promise<void> {
    try {
      const userId = data.sender_id;

      const loan = await this.loansRepository.findOne({
        where: { id: loanId, userId },
        relations: ['payments'],
      });

      if (!loan) {
        await this.sendMessage(data, '❌ Không tìm thấy khoản vay.');
        return;
      }

      const calculation = await this.calculateEarlyPaymentAmount(loan);
      const user = await this.usersRepository.findOne({ where: { userId } });

      if (!user || parseFloat(user.balance) < calculation.totalAmount) {
        await this.sendMessage(data, '❌ Số dư không đủ để thực hiện thanh toán.');
        return;
      }

      // Thực hiện thanh toán
      await this.executeEarlyPayment(loan, user, calculation, data);

    } catch (error) {
      this.logger.error('Error confirming early payment:', error);
      await this.sendMessage(data, '❌ Lỗi khi xác nhận thanh toán trước hạn.');
    }
  }

  /**
   * Tính toán số tiền thanh toán trước hạn
   */
  private async calculateEarlyPaymentAmount(loan: Loans): Promise<{
    principalRemaining: number;
    interestSaved: number;
    totalAmount: number;
    feesPaid: number;
    paymentsCompleted: number;
    paymentsRemaining: number;
  }> {
    // Lấy các payments đã thanh toán
    const paidPayments = loan.payments.filter(p =>
      p.status === PaymentStatus.PAID || p.status === PaymentStatus.MINIMUM_PAID
    );

    // Lấy các payments chưa thanh toán
    const unpaidPayments = loan.payments.filter(p =>
      p.status === PaymentStatus.PENDING || p.status === PaymentStatus.OVERDUE
    );

    // Tính số tiền gốc đã trả
    const principalPaid = paidPayments.reduce((sum, payment) => {
      // Giả sử trong payment có thông tin về principal và interest
      // Nếu không có, tạm tính 70% là gốc, 30% là lãi
      const paymentAmount = parseFloat(payment.amount);
      const estimatedPrincipal = paymentAmount * 0.7; // Estimate, should be calculated properly
      return sum + estimatedPrincipal;
    }, 0);

    // Tính số tiền gốc còn lại
    const loanPrincipal = parseFloat(loan.amount);
    const principalRemaining = loanPrincipal - principalPaid;

    // Tính lãi đã trả
    const feesPaid = paidPayments.reduce((sum, payment) => {
      return sum + parseFloat(payment.fee || '0');
    }, 0);

    // Tính lãi tiết kiệm được (chỉ trả lãi cho thời gian đã vay)
    const totalScheduledAmount = loan.payments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount);
    }, 0);

    const remainingScheduledAmount = unpaidPayments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount);
    }, 0);

    // Lãi tiết kiệm = Lãi dự kiến - Lãi thực tế (giảm 20% lãi cho thanh toán trước hạn)
    const interestSaved = remainingScheduledAmount * 0.2;

    // Tổng tiền cần thanh toán = Gốc còn lại + Phí phạt (nếu có) - Lãi tiết kiệm
    const totalFees = unpaidPayments.reduce((sum, payment) => {
      return sum + parseFloat(payment.fee || '0');
    }, 0);

    const totalAmount = principalRemaining + totalFees - interestSaved;

    return {
      principalRemaining: Math.max(0, principalRemaining),
      interestSaved: Math.max(0, interestSaved),
      totalAmount: Math.max(0, totalAmount),
      feesPaid,
      paymentsCompleted: paidPayments.length,
      paymentsRemaining: unpaidPayments.length,
    };
  }

  /**
   * Thực hiện thanh toán trước hạn
   */
  private async executeEarlyPayment(
    loan: Loans,
    user: Users,
    calculation: any,
    data: ChannelMessage
  ): Promise<void> {
    // Tạo transaction cho thanh toán trước hạn
    const transaction = await this.transactionsRepository.save(
      this.transactionsRepository.create({
        transactionId: `EARLY_PAY_${Date.now()}_${loan.id}`,
        userId: user.userId,
        loanId: loan.id,
        amount: calculation.totalAmount.toString(),
        type: TransactionType.PAYMENT,
        status: 'completed',
      })
    );

    // Cập nhật số dư user
    const newBalance = parseFloat(user.balance) - calculation.totalAmount;
    await this.usersRepository.update(user.userId, {
      balance: newBalance.toString(),
    });

    // Cập nhật tất cả payments còn lại thành PAID
    const unpaidPayments = loan.payments.filter(p =>
      p.status === PaymentStatus.PENDING || p.status === PaymentStatus.OVERDUE
    );

    for (const payment of unpaidPayments) {
      await this.paymentsRepository.update(payment.id, {
        status: PaymentStatus.PAID,
        paidDate: new Date().toISOString().split('T')[0],
      });
    }

    // Cập nhật loan status
    await this.loansRepository.update(loan.id, {
      status: LoanStatus.REPAID,
    });

    // Gửi thông báo thành công
    const successMessage = this.formatEarlyPaymentSuccess(loan, calculation, transaction.transactionId);
    await this.sendMessage(data, successMessage);
  }

  /**
   * Format thông tin xác nhận thanh toán trước hạn
   */
  private formatEarlyPaymentConfirmation(loan: Loans, calculation: any): string {
    let message = '💰 **XÁC NHẬN THANH TOÁN TRƯỚC HẠN**\n\n';
    message += `🏦 **Khoản vay #${loan.id}**\n`;
    message += `💵 Số tiền vay gốc: ${formatVND(parseFloat(loan.amount))}\n`;
    message += `📊 Đã thanh toán: ${calculation.paymentsCompleted}/${loan.payments.length} kỳ\n\n`;

    message += `📋 **Chi tiết thanh toán trước hạn:**\n`;
    message += `• Gốc còn lại: ${formatVND(calculation.principalRemaining)}\n`;
    message += `• Phí phạt (nếu có): ${formatVND(calculation.feesPaid)}\n`;
    message += `• Lãi tiết kiệm được: -${formatVND(calculation.interestSaved)}\n`;
    message += `• **Tổng cần thanh toán: ${formatVND(calculation.totalAmount)}**\n\n`;

    message += `✅ **Lợi ích:**\n`;
    message += `• Tiết kiệm lãi: ${formatVND(calculation.interestSaved)}\n`;
    message += `• Hoàn thành sớm ${calculation.paymentsRemaining} kỳ thanh toán\n`;
    message += `• Tăng điểm tín dụng\n\n`;

    message += `💡 **Để xác nhận thanh toán, gõ:**\n`;
    message += `\`$xntt ${loan.id}\`\n\n`;
    message += `⚠️ **Lưu ý:** Thao tác này không thể hoàn tác!`;

    return message;
  }

  /**
   * Format thông báo thành công thanh toán trước hạn
   */
  private formatEarlyPaymentSuccess(loan: Loans, calculation: any, transactionId: string): string {
    let message = '🎉 **THANH TOÁN TRƯỚC HẠN THÀNH CÔNG!**\n\n';
    message += `🆔 Mã giao dịch: ${transactionId}\n`;
    message += `🏦 Khoản vay #${loan.id} đã được thanh toán đầy đủ\n\n`;

    message += `💰 **Tổng kết:**\n`;
    message += `• Số tiền đã thanh toán: ${formatVND(calculation.totalAmount)}\n`;
    message += `• Lãi tiết kiệm được: ${formatVND(calculation.interestSaved)}\n`;
    message += `• Hoàn thành sớm: ${calculation.paymentsRemaining} kỳ\n\n`;

    message += `📈 **Lợi ích đạt được:**\n`;
    message += `• ✅ Khoản vay đã hoàn thành\n`;
    message += `• 💰 Tiết kiệm chi phí lãi\n`;
    message += `• 📊 Tăng điểm tín dụng\n`;
    message += `• 🆓 Có thể vay mới với điều kiện tốt hơn\n\n`;

    message += `🏆 Chúc mừng bạn đã hoàn thành khoản vay trước thời hạn!`;

    return message;
  }

  /**
   * Lấy tất cả payments của user (pending và overdue)
   */
  async getAllPayments(data: ChannelMessage): Promise<void> {
    try {
      const userId = data.sender_id;
      
      const pendingPayments = await this.paymentsRepository.find({
        where: [
          { userId, status: PaymentStatus.PENDING },
          { userId, status: PaymentStatus.OVERDUE },
        ],
        relations: ['loan'],
        order: { dueDate: 'ASC' },
      });

      if (!pendingPayments.length) {
        await this.sendMessage(data, '✅ **Danh sách thanh toán**\n\nBạn không có khoản thanh toán nào đang chờ xử lý.');
        return;
      }

      let message = '📋 **Tất cả thanh toán cần xử lý**\n\n';
      
      pendingPayments.forEach((payment, index) => {
        const daysUntilDue = this.getDaysUntilDue(payment.dueDate);
        const isOverdue = daysUntilDue < 0;
        const statusIcon = isOverdue ? '🔴' : (daysUntilDue <= 3 ? '🟠' : '🟡');
        const lateFee = parseFloat(payment.fee || '0');
        
        message += `${statusIcon} **${index + 1}. Khoản thanh toán #${payment.id}**\n`;
        message += `   🆔 **Payment ID: ${payment.id}**\n`;
        message += `   💰 Số tiền: ${formatVND(parseFloat(payment.amount))}\n`;
        message += `   💳 Tối thiểu: ${formatVND(parseFloat(payment.minimumAmount))}\n`;
        if (lateFee > 0) {
          message += `   🚫 Phí phạt: ${formatVND(lateFee)}\n`;
        }
        message += `   📅 Hạn thanh toán: ${payment.dueDate}\n`;
        if (isOverdue) {
          message += `   ⚠️ Quá hạn: ${Math.abs(daysUntilDue)} ngày\n`;
        } else {
          message += `   ⏳ Còn lại: ${daysUntilDue} ngày\n`;
        }
        message += `   ▶️ **Lệnh:** \`$tt ${payment.id} <số_tiền>\`\n\n`;
      });

      message += '💡 **Hướng dẫn:**\n';
      message += '- Copy chính xác Payment ID để thanh toán\n';
      message += '- Có thể thanh toán tối thiểu hoặc toàn bộ\n';
      message += '- Thanh toán quá hạn sẽ có thêm phí phạt';

      await this.sendMessage(data, message);

    } catch (error) {
      this.logger.error('Error getting all payments:', error);
      await this.sendMessage(data, '❌ Lỗi khi lấy danh sách thanh toán.');
    }
  }

  /**
   * Lấy lịch sử thanh toán của user
   */
  async getPaymentHistory(data: ChannelMessage): Promise<void> {
    try {
      const userId = data.sender_id;
      
      const payments = await this.paymentsRepository.find({
        where: { userId },
        relations: ['loan'],
        order: { dueDate: 'DESC' },
        take: 20, // Lấy 20 khoản thanh toán gần nhất
      });

      if (!payments.length) {
        await this.sendMessage(data, '📋 **Lịch sử thanh toán**\n\n❌ Bạn chưa có khoản thanh toán nào.');
        return;
      }

      const historyMessage = this.formatPaymentHistory(payments);
      await this.sendMessage(data, historyMessage);

    } catch (error) {
      this.logger.error('Error getting payment history:', error);
      await this.sendMessage(data, '❌ Lỗi khi lấy lịch sử thanh toán. Vui lòng thử lại sau.');
    }
  }

  /**
   * Kiểm tra các khoản thanh toán sắp đến hạn
   */
  async checkUpcomingPayments(data: ChannelMessage): Promise<void> {
    try {
      const userId = data.sender_id;
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const upcomingPayments = await this.paymentsRepository.find({
        where: {
          userId,
          status: PaymentStatus.PENDING,
          dueDate: LessThan(nextWeek.toISOString().split('T')[0]),
        },
        relations: ['loan'],
        order: { dueDate: 'ASC' },
      });

      if (!upcomingPayments.length) {
        await this.sendMessage(data, '✅ **Thanh toán sắp tới**\n\nBạn không có khoản thanh toán nào sắp đến hạn trong 7 ngày tới.');
        return;
      }

      const message = this.formatUpcomingPayments(upcomingPayments);
      await this.sendMessage(data, message);

    } catch (error) {
      this.logger.error('Error checking upcoming payments:', error);
      await this.sendMessage(data, '❌ Lỗi khi kiểm tra thanh toán sắp tới.');
    }
  }

  /**
   * Kiểm tra các khoản thanh toán quá hạn
   */
  async checkOverduePayments(userId?: string): Promise<Payments[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const whereCondition: any = {
        status: PaymentStatus.PENDING,
        dueDate: LessThan(today),
      };

      if (userId) {
        whereCondition.userId = userId;
      }

      const overduePayments = await this.paymentsRepository.find({
        where: whereCondition,
        relations: ['loan', 'user'],
        order: { dueDate: 'ASC' },
      });

      return overduePayments;
    } catch (error) {
      this.logger.error('Error checking overdue payments:', error);
      return [];
    }
  }

  /**
   * Tính toán tiền phạt cho thanh toán trễ
   */
  calculateLateFee(payment: Payments): number {
    const today = new Date();
    const dueDate = new Date(payment.dueDate);
    const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) return 0;

    const paymentAmount = parseFloat(payment.amount);
    let lateFeeRate = 0;

    // Tính phí phạt theo ngày trễ
    if (daysLate <= 7) {
      lateFeeRate = 0.005; // 0.5%/ngày cho 7 ngày đầu
    } else if (daysLate <= 30) {
      lateFeeRate = 0.01; // 1%/ngày từ ngày 8-30
    } else {
      lateFeeRate = 0.015; // 1.5%/ngày sau 30 ngày
    }

    const lateFee = paymentAmount * lateFeeRate * daysLate;
    return Math.round(lateFee);
  }

  /**
   * Cập nhật trạng thái quá hạn và tính phí phạt
   */
  async updateOverduePayments(): Promise<void> {
    try {
      const overduePayments = await this.checkOverduePayments();

      for (const payment of overduePayments) {
        const lateFee = this.calculateLateFee(payment);
        
        // Cập nhật payment với trạng thái overdue và phí phạt
        await this.paymentsRepository.update(payment.id, {
          status: PaymentStatus.OVERDUE,
          fee: lateFee.toString(),
        });

        // Cập nhật loan status nếu cần
        await this.loansRepository.update(payment.loanId, {
          status: LoanStatus.OVERDUE,
        });

        this.logger.log(`Updated overdue payment ${payment.id} with late fee: ${lateFee}`);
      }
    } catch (error) {
      this.logger.error('Error updating overdue payments:', error);
    }
  }

  /**
   * Xử lý thanh toán khoản vay
   */
  async processPayment(data: ChannelMessage, paymentId: string, amount: number): Promise<void> {
    try {
      const userId = data.sender_id;
      
      // Kiểm tra payment có tồn tại không
      const payment = await this.paymentsRepository.findOne({
        where: { id: paymentId, userId },
        relations: ['loan'],
      });

      if (!payment) {
        await this.sendMessage(data, '❌ Không tìm thấy khoản thanh toán này.');
        return;
      }

      if (payment.status === PaymentStatus.PAID) {
        await this.sendMessage(data, '✅ Khoản thanh toán này đã được thanh toán rồi.');
        return;
      }

      // Kiểm tra số dư người dùng
      const user = await this.usersRepository.findOne({ where: { userId } });
      if (!user || parseFloat(user.balance) < amount) {
        await this.sendMessage(data, '❌ Số dư không đủ để thực hiện thanh toán.');
        return;
      }

      const paymentAmount = parseFloat(payment.amount);
      const minimumAmount = parseFloat(payment.minimumAmount);
      const lateFee = parseFloat(payment.fee || '0');
      const totalRequired = paymentAmount + lateFee;

      // Kiểm tra số tiền thanh toán
      if (amount < minimumAmount) {
        await this.sendMessage(data, 
          `❌ Số tiền thanh toán tối thiểu là ${formatVND(minimumAmount)}.\n` +
          `💰 Bạn đang thanh toán: ${formatVND(amount)}`
        );
        return;
      }

      // Thực hiện thanh toán
      await this.executePayment(payment, user, amount, data);

    } catch (error) {
      this.logger.error('Error processing payment:', error);
      await this.sendMessage(data, '❌ Lỗi khi xử lý thanh toán. Vui lòng thử lại sau.');
    }
  }

  /**
   * Thực thi thanh toán
   */
  private async executePayment(
    payment: Payments, 
    user: Users, 
    amount: number,
    data: ChannelMessage
  ): Promise<void> {
    const paymentAmount = parseFloat(payment.amount);
    const lateFee = parseFloat(payment.fee || '0');
    const totalRequired = paymentAmount + lateFee;

    // Tạo transaction
    const transaction = await this.transactionsRepository.save(
      this.transactionsRepository.create({
        transactionId: `PAY_${Date.now()}_${payment.id}`,
        userId: user.userId,
        loanId: payment.loanId,
        paymentId: payment.id,
        amount: amount.toString(),
        type: TransactionType.PAYMENT,
        status: 'completed',
      })
    );

    // Cập nhật số dư user
    const newBalance = parseFloat(user.balance) - amount;
    await this.usersRepository.update(user.userId, {
      balance: newBalance.toString(),
    });

    // Xác định trạng thái thanh toán
    let newStatus: PaymentStatus;
    if (amount >= totalRequired) {
      newStatus = PaymentStatus.PAID;
    } else if (amount >= parseFloat(payment.minimumAmount)) {
      newStatus = PaymentStatus.MINIMUM_PAID;
    } else {
      newStatus = PaymentStatus.PENDING;
    }

    // Cập nhật payment
    await this.paymentsRepository.update(payment.id, {
      status: newStatus,
      paidDate: new Date().toISOString().split('T')[0],
    });

    // Kiểm tra xem loan đã hoàn thành chưa
    await this.checkLoanCompletion(payment.loanId);

    // Gửi thông báo thành công
    const message = this.formatPaymentSuccessMessage(payment, amount, newStatus, transaction.transactionId);
    await this.sendMessage(data, message);
  }

  /**
   * Kiểm tra xem loan đã hoàn thành chưa
   */
  private async checkLoanCompletion(loanId: string): Promise<void> {
    const pendingPayments = await this.paymentsRepository.count({
      where: {
        loanId,
        status: PaymentStatus.PENDING,
      },
    });

    if (pendingPayments === 0) {
      await this.loansRepository.update(loanId, {
        status: LoanStatus.REPAID,
      });
      this.logger.log(`Loan ${loanId} completed - all payments made`);
    }
  }

  /**
   * Format payment history message
   */
  private formatPaymentHistory(payments: Payments[]): string {
    let message = '📋 **Lịch sử thanh toán**\n\n';
    
    payments.forEach((payment, index) => {
      const statusIcon = this.getPaymentStatusIcon(payment.status);
      const lateFee = parseFloat(payment.fee || '0');
      
      message += `${index + 1}. ${statusIcon} **Khoản thanh toán #${payment.id}**\n`;
      message += `   💰 Số tiền: ${formatVND(parseFloat(payment.amount))}\n`;
      if (lateFee > 0) {
        message += `   🚫 Phí phạt: ${formatVND(lateFee)}\n`;
      }
      message += `   📅 Hạn thanh toán: ${payment.dueDate}\n`;
      if (payment.paidDate) {
        message += `   ✅ Ngày thanh toán: ${payment.paidDate}\n`;
      }
      message += `   📊 Trạng thái: ${this.getPaymentStatusText(payment.status)}\n\n`;
    });

    return message;
  }

  /**
   * Format upcoming payments message
   */
  private formatUpcomingPayments(payments: Payments[]): string {
    let message = '⏰ **Thanh toán sắp tới**\n\n';
    
    payments.forEach((payment, index) => {
      const daysUntilDue = this.getDaysUntilDue(payment.dueDate);
      const urgencyIcon = daysUntilDue <= 3 ? '🔴' : daysUntilDue <= 7 ? '🟡' : '🟢';
      
      message += `${urgencyIcon} **Khoản thanh toán #${payment.id}**\n`;
      message += `   🆔 **Payment ID: ${payment.id}**\n`;
      message += `   💰 Số tiền: ${formatVND(parseFloat(payment.amount))}\n`;
      message += `   💳 Tối thiểu: ${formatVND(parseFloat(payment.minimumAmount))}\n`;
      message += `   📅 Hạn thanh toán: ${payment.dueDate}\n`;
      message += `   ⏳ Còn lại: ${daysUntilDue} ngày\n`;
      message += `   ▶️ **Lệnh thanh toán:** \`$tt ${payment.id} <số_tiền>\`\n\n`;
    });

    message += '💡 **Gợi ý:** Copy chính xác Payment ID từ danh sách trên để thanh toán';
    
    return message;
  }

  /**
   * Format payment success message
   */
  private formatPaymentSuccessMessage(
    payment: Payments, 
    amount: number, 
    status: PaymentStatus,
    transactionId: string
  ): string {
    let message = '✅ **Thanh toán thành công!**\n\n';
    message += `🆔 Mã giao dịch: ${transactionId}\n`;
    message += `💰 Số tiền đã thanh toán: ${formatVND(amount)}\n`;
    message += `📋 Khoản thanh toán: #${payment.id}\n`;
    message += `📊 Trạng thái: ${this.getPaymentStatusText(status)}\n\n`;
    
    if (status === PaymentStatus.MINIMUM_PAID) {
      const remaining = parseFloat(payment.amount) - amount;
      message += `⚠️ Bạn đã thanh toán tối thiểu. Còn lại: ${formatVND(remaining)}`;
    } else if (status === PaymentStatus.PAID) {
      message += '🎉 Khoản thanh toán đã được hoàn thành!';
    }
    
    return message;
  }

  /**
   * Utility methods
   */
  private getPaymentStatusIcon(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.PAID: return '✅';
      case PaymentStatus.MINIMUM_PAID: return '🟡';
      case PaymentStatus.OVERDUE: return '🔴';
      case PaymentStatus.PENDING: return '⏳';
      default: return '❓';
    }
  }

  private getPaymentStatusText(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.PAID: return 'Đã thanh toán';
      case PaymentStatus.MINIMUM_PAID: return 'Thanh toán tối thiểu';
      case PaymentStatus.OVERDUE: return 'Quá hạn';
      case PaymentStatus.PENDING: return 'Chờ thanh toán';
      default: return 'Không xác định';
    }
  }

  private getDaysUntilDue(dueDate: string): number {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private async sendMessage(data: ChannelMessage, content: string): Promise<void> {
    await this.mezonService.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id!,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content,
        },
      },
    });
  }
}
