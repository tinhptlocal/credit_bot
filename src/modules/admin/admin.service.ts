import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ADMIN_IDS } from 'src/constant/index';
import {
  Loans,
  Payments,
  Roles,
  Transactions,
  UserRoles,
  Users,
} from 'src/entities';
import { MezonService } from 'src/shared/mezon/mezon.service';
import { LoanStatus } from 'src/types';
import { Between, Repository } from 'typeorm';
import { LoanService } from '../loan/loan.service';
import { UserService } from '../user/user.service';

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
    private readonly mezonService: MezonService,
    private readonly userService: UserService,
    private readonly loanService: LoanService,
  ) {}

  async onModuleInit() {
    await this.initializeDefaultRoles();
    await this.initializeDefaultAdmin();
  }

  async isAdmin(userId: string): Promise<boolean> {
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
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException('Only admins can approve loans');
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

  async rejectLoan(
    loanId: string,
    adminId: string,
    reason?: string,
  ): Promise<Loans> {
    if (!(await this.isAdmin(adminId))) {
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

  async banUser(
    userId: string,
    adminId: string,
    reason?: string,
  ): Promise<void> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException('Only admins can ban users');
    }

    const user = await this.getUserById(userId);
    // user.banned = true;
    // await this.userRepository.save(user);
  }

  async unbanUser(userId: string, adminId: string): Promise<void> {
    if (!(await this.isAdmin(adminId))) {
      throw new ForbiddenException('Only admins can unban users');
    }

    const user = await this.getUserById(userId);
    // user.banned = false;
    // await this.userRepository.save(user);
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
      user.userId === process.env.BOT_ID
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
          creditScore: 1000,
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

  async createAdmin(username: string, userId: string): Promise<Users> {
    const adminRole = await this.roleRepository.findOne({
      where: { name: 'admin' },
    });

    if (!adminRole) {
      throw new Error('Admin role not found');
    }

    const newAdmin = this.userRepository.create({
      username,
      userId,
      balance: '0',
      creditScore: 1000,
    });

    const savedAdmin = await this.userRepository.save(newAdmin);

    const adminUserRole = this.userRoleRepository.create({
      userId: savedAdmin.userId,
      roleId: adminRole.id,
    });

    await this.userRoleRepository.save(adminUserRole);

    this.logger.log(`New admin created: ${username} (${userId})`);
    return savedAdmin;
  }

  async removeAdmin(userId: string): Promise<void> {
    const adminRole = await this.roleRepository.findOne({
      where: { name: 'admin' },
    });

    if (!adminRole) {
      throw new Error('Admin role not found');
    }

    const adminUserRole = await this.userRoleRepository.findOne({
      where: { userId, roleId: adminRole.id },
    });

    if (adminUserRole) {
      await this.userRoleRepository.remove(adminUserRole);
      this.logger.log(`Admin privileges removed for user: ${userId}`);
    }
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
      (user) => user.creditScore >= 800 && user.creditScore <= 1000,
    ).length;
    const goodUsers = filteredUsers.filter(
      (user) => user.creditScore >= 650 && user.creditScore <= 799,
    ).length;
    const fairUsers = filteredUsers.filter(
      (user) => user.creditScore >= 500 && user.creditScore <= 649,
    ).length;
    const poorUsers = filteredUsers.filter(
      (user) => user.creditScore >= 300 && user.creditScore <= 499,
    ).length;
    const veryPoorUsers = filteredUsers.filter(
      (user) => user.creditScore >= 0 && user.creditScore <= 299,
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
}
