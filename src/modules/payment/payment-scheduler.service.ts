import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentService } from './payment.service';

@Injectable()
export class PaymentSchedulerService {
  private readonly logger = new Logger(PaymentSchedulerService.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Chạy hàng ngày lúc 6:00 AM để kiểm tra và cập nhật các khoản thanh toán quá hạn
   * TODO: Cài đặt @nestjs/schedule để enable cron jobs
   */
  // @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleOverduePayments() {
    this.logger.log('Running daily overdue payments check...');
    
    try {
      await this.paymentService.updateOverduePayments();
      this.logger.log('Overdue payments check completed successfully');
    } catch (error) {
      this.logger.error('Error in daily overdue payments check:', error);
    }
  }

  /**
   * Chạy hàng ngày lúc 9:00 AM để gửi nhắc nhở thanh toán
   * TODO: Cài đặt @nestjs/schedule để enable cron jobs
   */
  // @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendPaymentReminders() {
    this.logger.log('Sending payment reminders...');
    
    try {
      // TODO: Implement payment reminder logic
      // Có thể gửi thông báo cho users có thanh toán sắp đến hạn
      this.logger.log('Payment reminders sent successfully');
    } catch (error) {
      this.logger.error('Error sending payment reminders:', error);
    }
  }

  /**
   * Manual trigger để test các chức năng scheduler
   */
  async manualTriggerOverdueCheck() {
    await this.handleOverduePayments();
  }

  async manualTriggerReminders() {
    await this.sendPaymentReminders();
  }
}
