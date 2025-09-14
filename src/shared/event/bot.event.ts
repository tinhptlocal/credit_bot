import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelMessage, Events, TokenSentEvent } from 'mezon-sdk';
import {
  ADD_ADMIN,
  ADMIN_APPROVE,
  ADMIN_CREDIT,
  ADMIN_FIND,
  ADMIN_GENERATE_PAYMENTS,
  ADMIN_KICK,
  ADMIN_LOANS,
  ADMIN_PREFIX,
  ADMIN_REJECT,
  ADMIN_STATS,
  ADMIN_USERS,
  ADMIN_WARN,
  ADMIN_WITHDRAW,
  ADMIN_BALANCE,
  CHECK_BALANCE_MESSAGE,
  CHECK_LOAN_ACTICE,
  HELP,
  LOANS,
  LOANS_CHECK,
  LOANS_LIST,
  OPTION_LOAN_TERMS,
  PAYMENT_CHECK_SCHEDULE,
  PAYMENT_CONFIRM,
  PAYMENT_EARLY,
  PAYMENT_HISTORY,
  PAYMENT_LIST,
  PAYMENT_OVERDUE,
  PAYMENT_PAY,
  PAYMENT_UPCOMING,
  STARTED_MESSAGE,
  STARTED_MESSAGE_WITH_BOT_NAME,
  WITH_DRAW,
} from 'src/constant';
import { formatVND } from 'src/shared/helper';
import { AdminService } from 'src/modules/admin/admin.service';
import { LoanService } from 'src/modules/loan/loan.service';
import { PaymentService } from 'src/modules/payment/payment.service';
import { TransactionService } from 'src/modules/transaction/transaction.service';
import { UserService } from 'src/modules/user/user.service';
import { MezonService } from '../mezon/mezon.service';
import {
  EMessagePayloadType,
  EMessageType,
  MessageButtonClickedEvent,
} from '../mezon/types/mezon.type';

@Injectable()
export class BotEvent {
  constructor(
    private readonly userService: UserService,
    private readonly transactionService: TransactionService,
    private readonly mezonService: MezonService,
    private readonly loanService: LoanService,
    private readonly adminService: AdminService,
    private readonly paymentService: PaymentService,
  ) {}

  @OnEvent(Events.TokenSend)
  async handleTokenSentEvent(data: TokenSentEvent) {
    await this.transactionService.createToken(data);
  }

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessageEvent(data: ChannelMessage) {
    const message = data.content.t;
    if (message === STARTED_MESSAGE_WITH_BOT_NAME) {
      await this.userService.introduce(data);
    } else if (message === `${STARTED_MESSAGE}${CHECK_BALANCE_MESSAGE}`) {
      await this.userService.checkBalance(data);
    } else if (message?.startsWith(`${STARTED_MESSAGE}${WITH_DRAW}`)) {
      const numberInString = message.match(/\d+/);
      if (numberInString) {
        await this.userService.withDraw(data, String(numberInString[0]));
      }
    } else if (data.content.t?.startsWith(`${STARTED_MESSAGE}${LOANS}`)) {
      await this.handleCreateLoans(data);
    } else if (data.content.t === `${STARTED_MESSAGE}${LOANS_CHECK}`) {
      await this.loanService.getLoanStatus(data);
    } else if (data.content.t === `${STARTED_MESSAGE}${LOANS_LIST}`) {
      await this.loanService.getLoanActive(data);
    } else if (message?.startsWith(ADMIN_PREFIX)) {
      await this.handleAdminCommands(data);
    } else if (message === `${STARTED_MESSAGE}${CHECK_LOAN_ACTICE}`) {
      await this.loanService.getLoanActive(data);
    } else if (
      message?.startsWith(`${STARTED_MESSAGE}${PAYMENT_CHECK_SCHEDULE}`)
    ) {
      const parts = message.split(' ');
      const username = parts[1];
      await this.loanService.getPaymentSchedule(data, username);
    } else if (data.content.t === `${STARTED_MESSAGE}${PAYMENT_HISTORY}`) {
      await this.paymentService.getPaymentHistory(data);
    } else if (data.content.t === `${STARTED_MESSAGE}${PAYMENT_UPCOMING}`) {
      await this.paymentService.checkUpcomingPayments(data);
    } else if (data.content.t === `${STARTED_MESSAGE}${PAYMENT_LIST}`) {
      await this.paymentService.getAllPayments(data);
    } else if (
      data.content.t?.startsWith(`${STARTED_MESSAGE}${PAYMENT_EARLY}`)
    ) {
      await this.handleEarlyPaymentCommand(data);
    } else if (data.content.t === `${STARTED_MESSAGE}${PAYMENT_OVERDUE}`) {
      await this.handleOverduePaymentsCheck(data);
    } else if (
      data.content.t?.startsWith(`${STARTED_MESSAGE}${PAYMENT_CONFIRM}`)
    ) {
      await this.handleConfirmEarlyPayment(data);
    } else if (data.content.t?.startsWith(`${STARTED_MESSAGE}${PAYMENT_PAY}`)) {
      await this.handlePaymentCommand(data);
    } else if (data.content.t?.startsWith(`${STARTED_MESSAGE}${HELP}`)) {
      await this.handleHelpCommand(data);
    }
  }

  @OnEvent(Events.MessageButtonClicked)
  async handleMessageButtonClickedEvent(data: MessageButtonClickedEvent) {
    await this.loanService.handleCLickButton(data);
  }

  async handleHelpCommand(data: ChannelMessage) {
    if (!data.content.t) return;

    await this.showUserHelp(data);
  }

  private async showUserHelp(data: ChannelMessage) {
    const message =
      `🤖 **HƯỚNG DẪN SỬ DỤNG CREDIT BOT**\n\n` +
      `📋 **LỆNH CƠ BẢN:**\n` +
      `• \`$start\` - Đăng ký tài khoản\n` +
      `• \`$kttk\` - Kiểm tra số dư\n` +
      `• \`$rut <số_tiền>\` - Rút tiền\n\n` +
      `💰 **QUẢN LÝ KHOẢN VAY:**\n` +
      `• \`$vay <số_tiền> <số_tháng>\` - Đăng ký vay tiền\n` +
      `• \`$ktvay\` - Kiểm tra trạng thái khoản vay\n` +
      `• \`$dsvay\` - Xem danh sách khoản vay đang hoạt động\n\n` +
      `💳 **THANH TOÁN:**\n` +
      `• \`$lstt\` - Xem lịch sử thanh toán\n` +
      `• \`$ttst\` - Xem thanh toán sắp tới\n` +
      `• \`$tt <payment_id> <số_tiền>\` - Thực hiện thanh toán\n` +
      `• \`$ttqh\` - Xem thanh toán quá hạn\n` +
      `• \`$dstt\` - Xem tất cả thanh toán\n\n` +
      `⚡ **THANH TOÁN TRƯỚC HẠN:**\n` +
      `• \`$tth <loan_id>\` - Tính toán thanh toán trước hạn\n` +
      `• \`$xntt <loan_id>\` - Xác nhận thanh toán trước hạn\n\n` +
      `📝 **VÍ DỤ:**\n` +
      `• \`$vay 5000000 6\` - Vay 5 triệu trong 6 tháng\n` +
      `• \`$tt 12345 500000\` - Thanh toán 500k cho payment ID 12345\n` +
      `• \`$tth 67890\` - Thanh toán trước hạn loan ID 67890\n\n` +
      `💡 **LƯU Ý:**\n` +
      `• Kỳ hạn vay hỗ trợ: 3, 6, 9, 12 tháng\n` +
      `• Thanh toán trước hạn sẽ tiết kiệm lãi suất\n` +
      `• Copy chính xác Payment ID từ danh sách để thanh toán\n\n` +
      `🔧 **ADMIN:** Gõ \`$admin\` để xem các lệnh quản trị`;

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

  async handleConfirmEarlyPayment(data: ChannelMessage) {
    if (!data.content.t) return;
    const params = data.content.t.split(' ');

    if (params.length !== 2) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: '❌ Cú pháp không đúng. Vui lòng sử dụng: $xntt <loan_id>',
          },
        },
      });
      return;
    }

    const loanId = params[1];
    await this.paymentService.confirmEarlyPayment(data, loanId);
  }

  async handlePaymentCommand(data: ChannelMessage) {
    if (!data.content.t) return;
    const params = data.content.t.split(' ');

    if (params.length !== 3) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              '❌ Cú pháp không đúng. Vui lòng sử dụng: $tt <payment_id> <số_tiền>',
          },
        },
      });
      return;
    }

    const paymentId = params[1];
    const amount = parseInt(params[2]);

    if (isNaN(amount) || amount <= 0) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: '❌ Số tiền thanh toán không hợp lệ.',
          },
        },
      });
      return;
    }

    await this.paymentService.processPayment(data, paymentId, amount);
  }

  async handleEarlyPaymentCommand(data: ChannelMessage) {
    if (!data.content.t) return;
    const params = data.content.t.split(' ');

    if (params.length !== 2) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: '❌ Cú pháp không đúng. Vui lòng sử dụng: $tth <loan_id>',
          },
        },
      });
      return;
    }

    const loanId = params[1];
    await this.paymentService.payEarlyFullLoan(data, loanId);
  }

  async handleOverduePaymentsCheck(data: ChannelMessage) {
    const userId = data.sender_id;
    const overduePayments =
      await this.paymentService.checkOverduePayments(userId);

    if (!overduePayments.length) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: '✅ Bạn không có khoản thanh toán nào quá hạn.',
          },
        },
      });
      return;
    }

    let message = '🔴 Các khoản thanh toán quá hạn:\n\n';

    overduePayments.forEach((payment, index) => {
      const lateFee = parseFloat(payment.fee || '0');

      message += `${index + 1}. **Khoản thanh toán #${payment.id}**\n`;
      message += `🆔 **Payment ID: ${payment.id}**\n`;
      message += `💰 Số tiền: ${payment.amount} VND\n`;

      if (lateFee > 0) {
        message += `🚫 Phí phạt: ${lateFee} VND\n`;
      }

      message += `📅 Hạn thanh toán: ${payment.dueDate}\n`;
      message += `▶️ **Lệnh thanh toán: $tt ${payment.id} <số_tiền>**\n\n`;
    });

    message +=
      '💡 **Gợi ý:** Copy chính xác Payment ID từ danh sách trên để thanh toán ngay';

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

  async handleCreateLoans(data: ChannelMessage) {
    if (!data.content.t) return;
    const params = data.content.t.split(' ');

    if (params.length !== 3) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              '❌ Cú pháp không đúng. Vui lòng sử dụng: $vay <số_tiền> <số_tháng>',
          },
        },
      });
      return;
    }

    const amount = parseInt(params[1]);
    const term = parseInt(params[2]);

    if (!OPTION_LOAN_TERMS.includes(term)) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              '❌ Hiện chỉ có thể vay với các kỳ hạn: 3, 6, 9, 12 tháng.',
          },
        },
      });
      return;
    }

    await this.loanService.requestLoan(data, amount, term);
  }

  private async handleAdminCommands(data: ChannelMessage) {
    const message = data.content.t;
    const adminId = data.sender_id;
    if (!message) {
      return;
    }
    if (await this.adminService.isAdmin(adminId)) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        '❌ Bạn không có quyền sử dụng lệnh admin!',
        data.message_id,
      );
      return;
    }

    const parts = message.split(' ');
    const command = parts[1];

    try {
      switch (command) {
        case ADMIN_STATS:
          await this.handleStatsCommand(data);
          break;
        case ADMIN_LOANS:
          await this.handleLoansCommand(data);
          break;
        case ADMIN_USERS:
          await this.handleUsersCommand(data);
          break;
        case ADMIN_KICK:
          await this.handleKickCommand(data, parts);
          break;
        case ADMIN_WARN:
          await this.handleWarnCommand(data, parts);
          break;
        case ADMIN_APPROVE:
          await this.handleApproveCommand(data, parts);
          break;
        case ADMIN_REJECT:
          await this.handleRejectCommand(data, parts);
          break;
        case ADMIN_CREDIT:
          await this.handleCreditCommand(data, parts);
          break;
        case ADMIN_FIND:
          await this.handleFindCommand(data, parts);
          break;
        case ADMIN_GENERATE_PAYMENTS:
          await this.handleGeneratePaymentsCommand(data);
          break;
        case ADMIN_WITHDRAW:
          await this.handleAdminWithdrawCommand(data, parts);
          break;
        case ADMIN_BALANCE:
          await this.handleBotBalanceCommand(data);
        case ADD_ADMIN:
          await this.adminService.createAdmin(data);
          break;
        default:
          await this.showAdminHelp(data);
      }
    } catch (error) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Lỗi: ${error.message}`,
        data.message_id,
      );
    }
  }

  private async handleGeneratePaymentsCommand(data: ChannelMessage) {
    try {
      const result = await this.adminService.generateMissingPayments(
        data.sender_id,
      );
      const message =
        `🔧 **Tạo Payments cho Loans đã Approved**\n\n` +
        `✅ Đã tạo: ${result.created} payment schedules\n` +
        `⚠️ Bỏ qua: ${result.skipped} loans\n\n` +
        `💡 Các loans đã approved sẽ có payments được tạo tự động.`;

      await this.userService.sendSystemMessage(
        data.channel_id,
        message,
        data.message_id,
      );
    } catch (error) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Lỗi: ${error.message}`,
        data.message_id,
      );
    }
  }

  private async handleAdminWithdrawCommand(
    data: ChannelMessage,
    parts: string[],
  ) {
    if (parts.length < 3) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        '❌ Sử dụng: $admin withdraw <số_tiền>',
        data.message_id,
      );
      return;
    }

    const amount = parseInt(parts[2]);

    if (isNaN(amount) || amount <= 0) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        '❌ Số tiền rút không hợp lệ.',
        data.message_id,
      );
      return;
    }

    try {
      const result = await this.adminService.withdrawFromAdmin(
        data.sender_id,
        amount,
      );
      const message =
        `💰 **Admin Withdraw**\n\n` +
        `✅ Đã rút: ${amount.toLocaleString()} VND\n` +
        `💳 Số dư còn lại: ${result.remainingBalance.toLocaleString()} VND\n` +
        `📄 Transaction ID: ${result.transactionId}`;

      await this.userService.sendSystemMessage(
        data.channel_id,
        message,
        data.message_id,
      );
    } catch (error) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Lỗi: ${error.message}`,
        data.message_id,
      );
    }
  }

  private async handleStatsCommand(data: ChannelMessage) {
    const stats = await this.adminService.getSystemStatistics();
    const message =
      `📊 Thống kê hệ thống:\n` +
      `👥 Tổng users: ${stats.totalUsers}\n` +
      `💰 Tổng khoản vay: ${stats.totalLoans}\n` +
      `⏳ Chờ phê duyệt: ${stats.pendingLoans}\n` +
      `✅ Đã phê duyệt: ${stats.approvedLoans}\n` +
      `❌ Đã từ chối: ${stats.rejectedLoans}`;

    await this.userService.sendSystemMessage(
      data.channel_id,
      message,
      data.message_id,
    );
  }

  private async handleLoansCommand(data: ChannelMessage) {
    const loans = await this.adminService.getPendingLoans();
    if (loans.length === 0) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        '📋 Không có khoản vay nào chờ phê duyệt',
        data.message_id,
      );
      return;
    }

    let message = '📋 Khoản vay chờ phê duyệt:\n';
    loans.slice(0, 5).forEach((loan, index) => {
      message += `${index + 1}. ID: ${loan.id} | User: ${loan.user.username} (${loan.user.userId}) | Số tiền: ${loan.amount}\n`;
    });

    await this.userService.sendSystemMessage(
      data.channel_id,
      message,
      data.message_id,
    );
  }

  private async handleUsersCommand(data: ChannelMessage) {
    const users = await this.adminService.getAllUsers();
    const sortedUsers = users.sort(
      (a, b) => parseInt(b.balance) - parseInt(a.balance),
    );

    let message = `👥 Tổng số users: ${users.length}\n\n`;
    message += `📊 Danh sách users:\n`;

    sortedUsers.forEach((user, index) => {
      const role = user.userRoles?.[0]?.role?.name || 'user';
      const roleIcon = role === 'admin' ? '👑' : '👤';
      const balance = parseInt(user.balance).toLocaleString('vi-VN');
      message += `${index + 1}. ${roleIcon} ${user.username}\n`;
      message += `   💰 Số dư: ${balance} VND\n`;
      message += `   ⭐ Điểm tín dụng: ${user.creditScore}\n`;
      message += `   🆔 ID: \`${user.userId}\`\n`;
      message += `   🏷️ Role: ${role}\n\n`;
    });

    await this.userService.sendSystemMessage(
      data.channel_id,
      message,
      data.message_id,
    );
  }

  private async handleFindCommand(data: ChannelMessage, parts: string[]) {
    if (parts.length < 3) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        '❌ Sử dụng: $admin find <tên_hoặc_id>',
        data.message_id,
      );
      return;
    }

    const searchTerm = parts.slice(2).join(' ');

    try {
      const users = await this.adminService.searchUsers(searchTerm);

      if (users.length === 0) {
        await this.userService.sendSystemMessage(
          data.channel_id,
          `❌ Không tìm thấy user nào với từ khóa: "${searchTerm}"`,
          data.message_id,
        );
        return;
      }

      let message = `🔍 Kết quả tìm kiếm cho: "${searchTerm}"\n\n`;
      users.forEach((user, index) => {
        const role = user.userRoles?.[0]?.role?.name || 'user';
        const roleIcon = role === 'admin' ? '👑' : '👤';
        const balance = parseInt(user.balance).toLocaleString('vi-VN');
        message += `${index + 1}. ${roleIcon} ${user.username}\n`;
        message += `   💰 Số dư: ${balance} VND\n`;
        message += `   ⭐ Điểm tín dụng: ${user.creditScore}\n`;
        message += `   🆔 ID: \`${user.userId}\`\n`;
        message += `   🏷️ Role: ${role}\n\n`;
      });

      await this.userService.sendSystemMessage(
        data.channel_id,
        message,
        data.message_id,
      );
    } catch (error) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Lỗi: ${error.message}`,
        data.message_id,
      );
    }
  }

  private async handleKickCommand(data: ChannelMessage, parts: string[]) {
    if (parts.length < 3) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        '❌ Sử dụng: $admin kick <userName> [lý do]',
        data.message_id,
      );
      return;
    }

    const userName = parts[2];
    const reason = parts.slice(3).join(' ');

    try {
      const user = await this.adminService.getUserByUsername(userName);
      if (!user) {
        await this.userService.sendSystemMessage(
          data.channel_id,
          `❌ user name ${userName} chưa có khoản vay hoặc không tồn tại trong hệ thống!`,
          data.message_id,
        );
        return;
      }

      const userId = user.id;

      await this.adminService.kickUser(
        userName,
        data.channel_id,
        data.sender_id,
        reason,
      );
      await this.userService.sendSystemMessage(
        data.channel_id,
        `👢 Đã kick user ${user.username} (${userId})${reason ? ` - Lý do: ${reason}` : ''}`,
        data.message_id,
      );
    } catch (error) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Lỗi: ${error.message}`,
        data.message_id,
      );
    }
  }

  private async handleWarnCommand(data: ChannelMessage, parts: string[]) {
    if (parts.length < 4) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        '❌ Sử dụng: $admin warn <userName> <lý do>',
        data.message_id,
      );
      return;
    }

    const userName = parts[2];
    const reason = parts.slice(3).join(' ');

    try {
      const user = await this.adminService.getUserByUsername(userName);
      if (!user) {
        await this.userService.sendSystemMessage(
          data.channel_id,
          `❌ user name ${userName} chưa có khoản vay hoặc không tồn tại trong hệ thống!`,
          data.message_id,
        );
        return;
      }

      const userId = user.id;

      await this.adminService.warnUser(
        userName,
        data.channel_id,
        data.sender_id,
        reason,
      );
      await this.userService.sendSystemMessage(
        data.channel_id,
        `⚠️ Đã cảnh báo user ${user.username} (${userId}) - Lý do: ${reason}`,
        data.message_id,
      );
    } catch (error) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Lỗi: ${error.message}`,
        data.message_id,
      );
    }
  }

  private async handleApproveCommand(data: ChannelMessage, parts: string[]) {
    if (parts.length < 3) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        '❌ Sử dụng: $admin approve <loan_id>',
        data.message_id,
      );
      return;
    }

    const loanId = parts[2];

    try {
      const loan = await this.adminService.getLoanById(loanId);
      if (!loan) {
        await this.userService.sendSystemMessage(
          data.channel_id,
          `❌ Không tìm thấy khoản vay với ID: ${loanId}`,
          data.message_id,
        );
        return;
      }

      await this.adminService.approveLoan(loanId, data.sender_id);
      await this.userService.sendSystemMessage(
        data.channel_id,
        `✅ Đã phê duyệt khoản vay ${loanId} của user ${loan.user.username} (${loan.user.userId}) - Số tiền: ${loan.amount}`,
        data.message_id,
      );
    } catch (error) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Lỗi: ${error.message}`,
        data.message_id,
      );
    }
  }

  private async handleRejectCommand(data: ChannelMessage, parts: string[]) {
    if (parts.length < 3) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        '❌ Sử dụng: $admin reject <loan_id> [lý do]',
        data.message_id,
      );
      return;
    }

    const loanId = parts[2];
    const reason = parts.slice(3).join(' ');

    try {
      const loan = await this.adminService.getLoanById(loanId);
      if (!loan) {
        await this.userService.sendSystemMessage(
          data.channel_id,
          `❌ Không tìm thấy khoản vay với ID: ${loanId}`,
          data.message_id,
        );
        return;
      }

      await this.adminService.rejectLoan(loanId, data.sender_id, reason);
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Đã từ chối khoản vay ${loanId} của user ${loan.user.username} (${loan.user.userId}) - Số tiền: ${loan.amount}${reason ? ` - Lý do: ${reason}` : ''}`,
        data.message_id,
      );
    } catch (error) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Lỗi: ${error.message}`,
        data.message_id,
      );
    }
  }

  private async handleCreditCommand(data: ChannelMessage, parts: string[]) {
    if (parts.length < 4) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        '❌ Sử dụng: $admin credit <user_name> <điểm_mới>',
        data.message_id,
      );
      return;
    }

    const userName = parts[2];

    const newScore = parseInt(parts[3]);

    try {
      const user = await this.adminService.getUserByUsername(userName);
      if (!user) {
        await this.userService.sendSystemMessage(
          data.channel_id,
          `❌ Sử dụng: user ${userName} chưa vay vốn hoặc không tồn tại trong hệ thống vui!`,
          data.message_id,
        );
        return;
      }

      const userId = user.id;

      if (!user) {
        await this.userService.sendSystemMessage(
          data.channel_id,
          `❌ Không tìm thấy user với ID: ${userId}`,
          data.message_id,
        );
        return;
      }

      const oldScore = user.creditScore;
      await this.adminService.adjustCreditScore(
        userId,
        newScore,
        data.sender_id,
      );
      await this.userService.sendSystemMessage(
        data.channel_id,
        `✅ Đã điều chỉnh điểm tín dụng của user ${user.username} (${userId}) từ ${oldScore} → ${newScore}`,
        data.message_id,
      );
    } catch (error) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Lỗi: ${error.message}`,
        data.message_id,
      );
    }
  }

  private async handleBotBalanceCommand(data: ChannelMessage) {
    try {
      const balanceInfo = await this.adminService.getBotBalance();

      const message =
        `💰 **THÔNG TIN BALANCE HỆ THỐNG**\n\n` +
        `🤖 **Bot Account:** ${balanceInfo.botUserId}\n` +
        `💳 **Balance hiện tại:** ${formatVND(balanceInfo.balance)}\n\n` +
        `📊 **Thống kê tài chính:**\n` +
        `📈 Tổng tiền nhận (payments): ${formatVND(balanceInfo.totalPaymentsReceived)}\n` +
        `📉 Tổng tiền cho vay: ${formatVND(balanceInfo.totalLoansGiven)}\n` +
        `💰 Lợi nhuận ròng: ${formatVND(balanceInfo.netProfit)}\n\n` +
        `💡 **Ghi chú:** Balance này bao gồm tất cả tiền từ thanh toán của users`;

      await this.userService.sendSystemMessage(
        data.channel_id,
        message,
        data.message_id,
      );
    } catch (error) {
      await this.userService.sendSystemMessage(
        data.channel_id,
        `❌ Lỗi khi lấy thông tin balance: ${error.message}`,
        data.message_id,
      );
    }
  }

  private async showAdminHelp(data: ChannelMessage) {
    const message =
      `🛠️ Lệnh Admin:\n` +
      `📊 $admin stats - Thống kê hệ thống\n` +
      `� $admin balance - Xem balance bot/treasury\n` +
      `�📋 $admin loans - Xem khoản vay chờ phê duyệt\n` +
      `👥 $admin users - Xem danh sách users\n` +
      `🔍 $admin find <tên_hoặc_id> - Tìm kiếm user\n` +
      `🚫 $admin kick <user_name> [lý do] - Kick user\n` +
      `⚠️ $admin warn <user_name> <lý do> - Cảnh báo user\n` +
      `✅ $admin approve <loan_id> - Phê duyệt khoản vay\n` +
      `❌ $admin reject <loan_id> [lý do] - Từ chối khoản vay\n` +
      `💳 $admin credit <user_name> <điểm> - Điều chỉnh điểm tín dụng` +
      `👥 $admin add <user_name> <điểm> - Điều chỉnh điểm tín dụng`;

    await this.userService.sendSystemMessage(
      data.channel_id,
      message,
      data.message_id,
    );
  }
}
