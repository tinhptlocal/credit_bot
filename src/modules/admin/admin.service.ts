import { LoanService } from '../loan/loan.service';
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  Users,
  Roles,
  UserRoles,
  Loans,
  Transactions,
  Payments,
} from 'src/entities';
import { LoanStatus, PaymentStatus } from 'src/types';
import { UserService } from '../user/user.service';
import { ENV } from 'src/config';
import { ApiMessageMention, ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { MezonService } from 'src/shared/mezon/mezon.service';
import {
  EMessagePayloadType,
  EMessageType,
} from 'src/shared/mezon/types/mezon.type';

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    @InjectRepository(Roles)
    private readonly roleRepository: Repository<Roles>,
    @InjectRepository(UserRoles)
    private readonly userRoleRepository: Repository<UserRoles>,
    @InjectRepository(Loans)
    private readonly loanRepository: Repository<Loans>,
    @InjectRepository(Transactions)
    private readonly transactionRepository: Repository<Transactions>,
    @InjectRepository(Payments)
    private readonly paymentRepository: Repository<Payments>,
    private readonly userService: UserService,
    private readonly loanService: LoanService,
    private readonly mezonService: MezonService,
  ) {}

  async onModuleInit() {
    await this.initializeDefaultRoles();
    await this.initializeDefaultAdmin();
  }

  async isAdmin(userId: string): Promise<boolean> {
    const exists = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.userRoles', 'userRole')
      .innerJoin('userRole.role', 'role')
      .where('user.userId = :userId', { userId })
      .andWhere('role.name = :roleName', { roleName: 'admin' })
      .getExists();

    return exists;
  }

  /**
   * Kiểm tra admin bằng ADMIN_IDS constant (nhanh hơn)
   */
  private isAdminByIds(userId: string): boolean {
    return ADMIN_IDS.includes(userId);
  }

  async createRole(name: string): Promise<Roles> {
    const role = this.roleRepository.create({ name });
    return await this.roleRepository.save(role);
  }

  async assignRole(userId: string, roleName: string): Promise<UserRoles> {
    const role = await this.roleRepository.findOne({
      where: { name: roleName },
    });
    if (!role) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId: role.id,
    });
    return await this.userRoleRepository.save(userRole);
  }

  async getAllUsers(): Promise<Users[]> {
    const users = await this.userRepository.find({
      relations: ['userRoles', 'userRoles.role', 'loans'],
    });

    return users.filter((user) => !this.isBotUser(user));
  }

  async getUserById(userId: string): Promise<Users> {
    const user = await this.userRepository.findOne({
      where: { userId },
      relations: ['userRoles', 'userRoles.role', 'loans', 'transactions'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async getUserByUsername(username: string): Promise<Users | null> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) return null;

    return user;
  }

  async searchUsers(searchTerm: string): Promise<Users[]> {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('user.loans', 'loans')
      .where('user.username ILIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .orWhere('user.userId ILIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .getMany();
    return users.filter((user) => !this.isBotUser(user));
  }

  async updateUser(userId: string, updateData: Partial<Users>): Promise<Users> {
    const user = await this.getUserById(userId);
    Object.assign(user, updateData);
    return await this.userRepository.save(user);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    await this.userRepository.remove(user);
  }

  async adjustCreditScore(
    userId: string,
    newScore: number,
    adminId: string,
  ): Promise<Users> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException('Only admins can adjust credit scores');
    }

    const user = await this.getUserById(userId);
    user.creditScore = newScore;
    return await this.userRepository.save(user);
  }

  async getPendingLoans(): Promise<Loans[]> {
    return await this.loanRepository.find({
      where: { status: LoanStatus.PENDING },
      relations: ['user'],
    });
  }

  async approveLoan(loanId: string, adminId: string): Promise<Loans> {
    // Tạm thời debug để xem adminId
    this.logger.debug(`Trying to approve loan ${loanId} by admin ${adminId}`);
    this.logger.debug(`ADMIN_IDS: ${JSON.stringify(ADMIN_IDS)}`);
    
    // Kiểm tra admin qua ADMIN_IDS constant thay vì database
    if (!this.isAdminByIds(adminId)) {
      throw new ForbiddenException(`Only admins can approve loans. Your ID: ${adminId}, Admin IDs: ${ADMIN_IDS.join(', ')}`);
    }

    const loan = await this.loanRepository.findOne({
      where: { id: loanId },
      relations: ['user'],
    });
    if (!loan) {
      throw new NotFoundException(`Loan with ID ${loanId} not found`);
    }

    loan.status = LoanStatus.APPROVED;
    loan.startDate = new Date();
    loan.endDate = new Date(Date.now() + loan.term * 24 * 60 * 60 * 1000);

    await this.loanService.handleLoanApproval(loanId, adminId);

    return await this.loanRepository.save(loan);
  }

  /**
   * Tạo lịch thanh toán cho khoản vay đã được phê duyệt
   */
  private async createPaymentSchedule(loan: Loans): Promise<void> {
    const { monthlyPayment, minimumPayment } = this.calculateEMI(
      parseFloat(loan.amount),
      12, // 12% annual interest rate
      loan.term,
    );

    const payments: Partial<Payments>[] = [];
    const startDate = new Date(loan.startDate);

    for (let i = 1; i <= loan.term; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + i);

      // Đảm bảo ngày không vượt quá ngày cuối tháng
      if (dueDate.getDate() !== startDate.getDate()) {
        dueDate.setDate(0); // Set to last day of previous month
      }

      const payment: Partial<Payments> = {
        loanId: loan.id,
        userId: loan.userId,
        amount: monthlyPayment.toString(),
        minimumAmount: minimumPayment.toString(),
        dueDate: dueDate.toISOString().split('T')[0],
        status: PaymentStatus.PENDING,
        fee: '0',
        interestRate: '12.00',
        transactionId: `PENDING_${loan.id}_${i}`,
      };

      payments.push(payment);
    }

    await this.paymentRepository.save(payments);
    this.logger.log(
      `Created ${payments.length} payment records for loan ${loan.id}`,
    );
  }

  /**
   * Tính toán EMI (Equated Monthly Installment)
   */
  private calculateEMI(
    principal: number,
    annualRate: number,
    termInMonths: number,
  ): {
    monthlyPayment: number;
    minimumPayment: number;
    totalPayment: number;
    totalInterest: number;
  } {
    const monthlyRate = annualRate / 100 / 12;
    const numberOfPayments = termInMonths;

    // EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    const totalPayment = monthlyPayment * numberOfPayments;
    const totalInterest = totalPayment - principal;
    const minimumPayment = monthlyPayment * 0.1; // 10% of monthly payment

    return {
      monthlyPayment: Math.round(monthlyPayment),
      minimumPayment: Math.round(minimumPayment),
      totalPayment: Math.round(totalPayment),
      totalInterest: Math.round(totalInterest),
    };
  }

  /**
   * Tạo payment cho các loan đã approved nhưng chưa có payments
   * (Dành cho việc fix dữ liệu cũ)
   */
  async generateMissingPayments(
    adminId: string,
  ): Promise<{ created: number; skipped: number }> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException('Only admins can generate missing payments');
    }

    const approvedLoansWithoutPayments = await this.loanRepository
      .createQueryBuilder('loan')
      .leftJoin('loan.payments', 'payment')
      .where('loan.status = :status', { status: LoanStatus.APPROVED })
      .andWhere('payment.id IS NULL')
      .getMany();

    let created = 0;
    let skipped = 0;

    for (const loan of approvedLoansWithoutPayments) {
      try {
        await this.createPaymentSchedule(loan);
        created++;
        this.logger.log(`Generated payments for loan ${loan.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to generate payments for loan ${loan.id}:`,
          error,
        );
        skipped++;
      }
    }

    return { created, skipped };
  }

  /**
   * Admin rút tiền từ balance của mình
   */
  async withdrawFromAdmin(
    adminId: string,
    amount: number,
  ): Promise<{ remainingBalance: number; transactionId: string }> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException(
        'Only admins can withdraw from admin balance',
      );
    }

    const admin = await this.userRepository.findOne({
      where: { userId: adminId },
    });
    if (!admin) {
      throw new NotFoundException('Admin account not found');
    }

    const currentBalance = parseFloat(admin.balance);
    if (currentBalance < amount) {
      throw new ForbiddenException(
        `Insufficient balance. Current: ${currentBalance}, Requested: ${amount}`,
      );
    }

    // Cập nhật balance admin
    const newBalance = currentBalance - amount;
    await this.userRepository.update(adminId, {
      balance: newBalance.toString(),
    });

    // Tạo transaction record
    const transactionId = `ADMIN_WITHDRAW_${Date.now()}_${adminId}`;
    await this.transactionRepository.save(
      this.transactionRepository.create({
        transactionId,
        userId: adminId,
        amount: amount.toString(),
        type: 'withdrawal' as any,
        status: 'completed',
      }),
    );

    this.logger.log(
      `Admin ${adminId} withdrew ${amount} VND. New balance: ${newBalance}`,
    );

    return {
      remainingBalance: newBalance,
      transactionId,
    };
  }

  async rejectLoan(
    loanId: string,
    adminId: string,
    reason?: string,
  ): Promise<Loans> {
    if (!this.isAdminByIds(adminId)) {
      throw new ForbiddenException('Only admins can reject loans');
    }

    const loan = await this.loanRepository.findOne({
      where: { id: loanId },
      relations: ['user'],
    });
    if (!loan) {
      throw new NotFoundException(`Loan with ID ${loanId} not found`);
    }

    loan.status = LoanStatus.REJECTED;
    await this.loanService.handleLoanRejection(loanId, adminId, reason || '');

    return await this.loanRepository.save(loan);
  }

  async getSystemStatistics(): Promise<any> {
    const totalUsers = await this.userRepository.count();
    const totalLoans = await this.loanRepository.count();
    const pendingLoans = await this.loanRepository.count({
      where: { status: LoanStatus.PENDING },
    });
    const approvedLoans = await this.loanRepository.count({
      where: { status: LoanStatus.APPROVED },
    });
    const rejectedLoans = await this.loanRepository.count({
      where: { status: LoanStatus.REJECTED },
    });

    const totalLoanAmount = await this.loanRepository
      .createQueryBuilder('loan')
      .select('SUM(CAST(loan.amount AS BIGINT))', 'total')
      .where('loan.status = :status', { status: LoanStatus.APPROVED })
      .getRawOne();

    return {
      totalUsers,
      totalLoans,
      pendingLoans,
      approvedLoans,
      rejectedLoans,
      totalLoanAmount: totalLoanAmount?.total || '0',
    };
  }

  async sendNotificationToUser(
    userId: string,
    message: string,
    channelId: string,
  ): Promise<void> {
    await this.userService.sendSystemMessage(channelId, message);
  }

  async getLoanById(loanId: string): Promise<Loans | null> {
    return await this.loanRepository.findOne({
      where: { id: loanId },
      relations: ['user'],
    });
  }

  private isBotUser(user: Users): boolean {
    return (
      user.username?.includes('credit') ||
      user.username?.includes('bot') ||
      user.userId === ENV.BOT.ID
    );
  }

  private async initializeDefaultRoles(): Promise<void> {
    try {
      const existingRoles = await this.roleRepository.find();

      if (existingRoles.length === 0) {
        const adminRole = this.roleRepository.create({ name: 'admin' });
        const userRole = this.roleRepository.create({ name: 'user' });

        await this.roleRepository.save([adminRole, userRole]);
        this.logger.log('Default roles created successfully');
      } else {
        this.logger.log('Roles already exist, skipping creation');
      }
    } catch (error) {
      this.logger.error('Error initializing default roles:', error);
    }
  }

  private async initializeDefaultAdmin(): Promise<void> {
    try {
      const adminRole = await this.roleRepository.findOne({
        where: { name: 'admin' },
      });

      if (!adminRole) {
        this.logger.warn(
          'Admin role not found, cannot initialize default admin',
        );
        return;
      }

      const existingAdmin = await this.userRoleRepository.findOne({
        where: { roleId: adminRole.id },
        relations: ['user'],
      });

      if (!existingAdmin) {
        const defaultAdmin = this.userRepository.create({
          username: 'system_admin',
          userId: 'system_admin_001',
          balance: '0',
          creditScore: 100,
        });

        const savedAdmin = await this.userRepository.save(defaultAdmin);

        const adminUserRole = this.userRoleRepository.create({
          userId: savedAdmin.userId,
          roleId: adminRole.id,
        });

        await this.userRoleRepository.save(adminUserRole);
        this.logger.log('Default admin created successfully');
      } else {
        this.logger.log('Admin already exists, skipping creation');
      }
    } catch (error) {
      this.logger.error('Error initializing default admin:', error);
    }
  }

  async createAdmin(data: ChannelMessage): Promise<void> {
    const adminId = data?.sender_id;
    const adminName = data.display_name;
    const channelId = data?.channel_id;
    if (!(await this.isAdmin(adminId))) {
      await this.userService.sendSystemMessage(
        channelId,
        'Only admins can add new admins',
        data.message_id,
      );
    }

    const targetUserId = data.mentions?.[0].user_id;

    const targetUser = await this.userRepository.findOne({
      where: { userId: targetUserId },
      relations: ['userRoles', 'userRoles.role'],
    });

    let mentionUserName;

    if (!targetUser) {
      mentionUserName = await this.getUserNameInMention(data);

      await this.userRepository.save(
        this.userRepository.create({
          username: mentionUserName,
          userId: targetUserId,
          balance: '0',
          creditScore: 100,
        }),
      );
    }

    const adminRole = await this.roleRepository.findOne({
      where: { name: 'admin' },
    });

    const userRole = this.userRoleRepository.create({
      userId: targetUserId,
      roleId: adminRole?.id,
    });

    await this.userRoleRepository.save(userRole);

    await this.sendMessageAddAdmin({
      channelId,
      replyToMessageId: data.message_id ?? '',
      mentionUserName,
      adminName: adminName ?? '',
      adminId,
      mentionUserId: targetUserId ?? '',
    });
  }

  async getUserNameInMention(data: ChannelMessage) {
    let mentionUserName: string | undefined;
    if (data.content.t?.includes('@')) {
      const mention = data.mentions?.[0];
      if (mention) {
        const m = data.content.t.trim().split(/\s+/);
        const mentionIdx = m.findIndex((x) => x.startsWith('@'));
        mentionUserName = m
          .slice(mentionIdx, m.length)
          .filter((x) => !/^\d+$/.test(x))
          .map((x) => (x.startsWith('@') ? x.slice(1) : x))
          .join(' ')
          .trim();
      }
    } else {
      mentionUserName = data.references?.[0]?.message_sender_username;
    }

    return mentionUserName;
  }

  async sendMessageAddAdmin({
    channelId,
    replyToMessageId,
    mentionUserName,
    adminName,
    adminId,
    mentionUserId,
  }: {
    channelId: string;
    replyToMessageId: string;
    mentionUserName: string;
    adminName: string;
    adminId: string;
    mentionUserId: string;
  }) {
    const normalContent = `👑 ${mentionUserName} đã được thêm làm admin bởi ${adminName}`;
    const apiMentions: Array<ApiMessageMention> = [];

    const hostMentionString = adminName;
    const guestMentionString = mentionUserName;

    const hostMatch = new RegExp(`\\b${hostMentionString}\\b`).exec(
      normalContent,
    );
    const guestMatch = new RegExp(`\\b${guestMentionString}\\b`).exec(
      normalContent,
    );

    if (hostMatch) {
      apiMentions.push({
        user_id: adminId,
        channel_id: channelId,
        s: hostMatch.index,
        e: hostMatch.index + hostMentionString.length,
      });
    }

    if (guestMatch) {
      apiMentions.push({
        user_id: mentionUserId,
        channel_id: channelId,
        s: guestMatch.index,
        e: guestMatch.index + guestMentionString.length,
      });
    }

    await this.mezonService.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: replyToMessageId,
      payload: {
        channel_id: channelId,
        message: {
          type: EMessagePayloadType.OPTIONAL,
          content: {
            t: normalContent,
          },
        },
        mentions: apiMentions,
      },
    });
  }

  async kickUser(
    username: string,
    channelId: string,
    adminId: string,
    reason?: string,
  ): Promise<void> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException('Only admins can kick users');
    }

    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new NotFoundException(`User name ${username} not found`);
    }

    const message = reason
      ? `🚫 User ${user.username} has been kicked from the channel. Reason: ${reason}`
      : `🚫 User ${user.username} has been kicked from the channel.`;

    await this.userService.sendSystemMessage(channelId, message);
  }

  async warnUser(
    username: string,
    channelId: string,
    adminId: string,
    reason: string,
  ): Promise<void> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException('Only admins can warn users');
    }

    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new NotFoundException(`User name ${username} not found`);
    }

    const message = `⚠️ Warning: User ${user.username} has been warned. Reason: ${reason}`;
    await this.userService.sendSystemMessage(channelId, message);
  }

  async setChannelTopic(
    channelId: string,
    adminId: string,
    topic: string,
  ): Promise<void> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException('Only admins can set channel topic');
    }

    const message = `📝 Channel topic has been updated: ${topic}`;
    await this.userService.sendSystemMessage(channelId, message);
  }

  async lockChannel(channelId: string, adminId: string): Promise<void> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException('Only admins can lock channel');
    }

    const message = `🔒 Channel has been locked by admin.`;
    await this.userService.sendSystemMessage(channelId, message);
  }

  async unlockChannel(channelId: string, adminId: string): Promise<void> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException('Only admins can unlock channel');
    }

    const message = `🔓 Channel has been unlocked by admin.`;
    await this.userService.sendSystemMessage(channelId, message);
  }

  async emergencyShutdown(
    channelId: string,
    adminId: string,
    reason: string,
  ): Promise<void> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException(
        'Only admins can perform emergency shutdown',
      );
    }

    const message = `🚨 EMERGENCY SHUTDOWN: ${reason}. All services are temporarily disabled.`;
    await this.userService.sendSystemMessage(channelId, message);
  }

  async getSystemOverview(): Promise<any> {
    const allUsers = await this.userRepository.find();
    const filteredUsers = allUsers.filter((user) => !this.isBotUser(user));

    const [totalLoans, totalTransactions, totalPayments] = await Promise.all([
      this.loanRepository.count(),
      this.transactionRepository.count(),
      this.paymentRepository.count(),
    ]);

    return {
      totalUsers: filteredUsers.length,
      totalLoans,
      totalTransactions,
      totalPayments,
    };
  }

  async getLoanStatistics(): Promise<any> {
    const [
      pendingLoans,
      approvedLoans,
      rejectedLoans,
      repaidLoans,
      overdueLoans,
      dueLoans,
    ] = await Promise.all([
      this.loanRepository.count({ where: { status: LoanStatus.PENDING } }),
      this.loanRepository.count({ where: { status: LoanStatus.APPROVED } }),
      this.loanRepository.count({ where: { status: LoanStatus.REJECTED } }),
      this.loanRepository.count({ where: { status: LoanStatus.REPAID } }),
      this.loanRepository.count({ where: { status: LoanStatus.OVERDUE } }),
      this.loanRepository.count({ where: { status: LoanStatus.DUE } }),
    ]);

    const totalLoanAmount = await this.loanRepository
      .createQueryBuilder('loan')
      .select('SUM(CAST(loan.amount AS BIGINT))', 'total')
      .where('loan.status IN (:...statuses)', {
        statuses: [
          LoanStatus.APPROVED,
          LoanStatus.REPAID,
          LoanStatus.OVERDUE,
          LoanStatus.DUE,
        ],
      })
      .getRawOne();

    const totalRepaidAmount = await this.loanRepository
      .createQueryBuilder('loan')
      .select('SUM(CAST(loan.amount AS BIGINT))', 'total')
      .where('loan.status = :status', { status: LoanStatus.REPAID })
      .getRawOne();

    return {
      byStatus: {
        pending: pendingLoans,
        approved: approvedLoans,
        rejected: rejectedLoans,
        repaid: repaidLoans,
        overdue: overdueLoans,
        due: dueLoans,
      },
      totalLoanAmount: totalLoanAmount?.total || '0',
      totalRepaidAmount: totalRepaidAmount?.total || '0',
    };
  }

  async getUserStatistics(): Promise<any> {
    const allUsers = await this.userRepository.find();
    const filteredUsers = allUsers.filter((user) => !this.isBotUser(user));

    const totalUsers = filteredUsers.length;

    const excellentUsers = filteredUsers.filter(
      (user) => user.creditScore >= 80 && user.creditScore <= 100,
    ).length;
    const goodUsers = filteredUsers.filter(
      (user) => user.creditScore >= 65 && user.creditScore <= 79,
    ).length;
    const fairUsers = filteredUsers.filter(
      (user) => user.creditScore >= 50 && user.creditScore <= 64,
    ).length;
    const poorUsers = filteredUsers.filter(
      (user) => user.creditScore >= 30 && user.creditScore <= 49,
    ).length;
    const veryPoorUsers = filteredUsers.filter(
      (user) => user.creditScore >= 0 && user.creditScore <= 29,
    ).length;

    const avgCreditScore =
      filteredUsers.length > 0
        ? filteredUsers.reduce((sum, user) => sum + user.creditScore, 0) /
          filteredUsers.length
        : 0;

    return {
      totalUsers,
      byCreditScore: {
        excellent: excellentUsers,
        good: goodUsers,
        fair: fairUsers,
        poor: poorUsers,
        veryPoor: veryPoorUsers,
      },
      averageCreditScore: Math.round(avgCreditScore),
    };
  }

  async getTimeBasedStatistics(days: number = 30): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const usersInPeriod = await this.userRepository.find({
      where: {
        timestamp: {
          createdAt: Between(startDate, endDate),
        },
      },
    });

    const filteredUsers = usersInPeriod.filter((user) => !this.isBotUser(user));

    const [newLoans, newTransactions, newPayments] = await Promise.all([
      this.loanRepository.count({
        where: {
          timestamp: {
            createdAt: Between(startDate, endDate),
          },
        },
      }),
      this.transactionRepository.count({
        where: {
          timestamp: {
            createdAt: Between(startDate, endDate),
          },
        },
      }),
      this.paymentRepository.count({
        where: {
          timestamp: {
            createdAt: Between(startDate, endDate),
          },
        },
      }),
    ]);

    return {
      period: `${days} days`,
      newUsers: filteredUsers.length,
      newLoans,
      newTransactions,
      newPayments,
    };
  }

  async getTopUsers(limit: number = 10): Promise<any> {
    const allUsers = await this.userRepository
      .createQueryBuilder('user')
      .getMany();

    const filteredUsers = allUsers.filter((user) => !this.isBotUser(user));

    const topUsersByBalance = filteredUsers
      .sort((a, b) => parseInt(b.balance) - parseInt(a.balance))
      .slice(0, limit);

    const topUsersByCreditScore = filteredUsers
      .sort((a, b) => b.creditScore - a.creditScore)
      .slice(0, limit);

    return {
      byBalance: topUsersByBalance.map((user) => ({
        userId: user.userId,
        username: user.username,
        balance: user.balance,
        creditScore: user.creditScore,
      })),
      byCreditScore: topUsersByCreditScore.map((user) => ({
        userId: user.userId,
        username: user.username,
        balance: user.balance,
        creditScore: user.creditScore,
      })),
    };
  }

  async getRiskStatistics(): Promise<any> {
    const overdueLoans = await this.loanRepository.count({
      where: { status: LoanStatus.OVERDUE },
    });

    const totalActiveLoans = await this.loanRepository.count({
      where: { status: LoanStatus.APPROVED },
    });

    const riskRatio =
      totalActiveLoans > 0 ? (overdueLoans / totalActiveLoans) * 100 : 0;

    const lowCreditUsers = await this.userRepository.count({
      where: { creditScore: Between(0, 499) },
    });

    const totalUsers = await this.userRepository.count();
    const lowCreditRatio =
      totalUsers > 0 ? (lowCreditUsers / totalUsers) * 100 : 0;

    return {
      overdueLoans,
      totalActiveLoans,
      riskRatio: Math.round(riskRatio * 100) / 100,
      lowCreditUsers,
      totalUsers,
      lowCreditRatio: Math.round(lowCreditRatio * 100) / 100,
    };
  }

  async getDetailedReport(): Promise<any> {
    const [
      systemOverview,
      loanStats,
      userStats,
      timeStats,
      topUsers,
      riskStats,
    ] = await Promise.all([
      this.getSystemOverview(),
      this.getLoanStatistics(),
      this.getUserStatistics(),
      this.getTimeBasedStatistics(30),
      this.getTopUsers(5),
      this.getRiskStatistics(),
    ]);

    return {
      systemOverview,
      loanStatistics: loanStats,
      userStatistics: userStats,
      timeBasedStatistics: timeStats,
      topUsers,
      riskStatistics: riskStats,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Lấy thông tin balance của bot/treasury
   */
  async getBotBalance(): Promise<{
    botUserId: string;
    balance: number;
    totalPaymentsReceived: number;
    totalLoansGiven: number;
    netProfit: number;
  }> {
    const botUserId = ADMIN_IDS[0];

    // Lấy thông tin bot user
    const botUser = await this.userRepository.findOne({ where: { userId: botUserId } });
    const currentBalance = botUser ? parseFloat(botUser.balance) : 0;

    // Tính tổng tiền nhận được từ payments
    const paymentTransactions = await this.transactionRepository
      .createQueryBuilder('t')
      .where('t.type = :type', { type: 'payment' })
      .select('SUM(CAST(t.amount AS DECIMAL))', 'total')
      .getRawOne();

    const totalPaymentsReceived = parseFloat(paymentTransactions?.total || '0');

    // Tính tổng tiền đã cho vay (approved loans)
    const approvedLoans = await this.loanRepository
      .createQueryBuilder('l')
      .where('l.status = :status', { status: LoanStatus.APPROVED })
      .orWhere('l.status = :repaidStatus', { repaidStatus: LoanStatus.REPAID })
      .select('SUM(CAST(l.amount AS DECIMAL))', 'total')
      .getRawOne();

    const totalLoansGiven = parseFloat(approvedLoans?.total || '0');

    // Net profit = Tiền nhận - Tiền cho vay
    const netProfit = totalPaymentsReceived - totalLoansGiven;

    return {
      botUserId,
      balance: currentBalance,
      totalPaymentsReceived,
      totalLoansGiven,
      netProfit,
    };
  }
}
