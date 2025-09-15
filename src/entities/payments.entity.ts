import { PaymentStatus, TABLE } from 'src/types';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Loans } from './loans.entity';
import { TimeStamp } from './timestamp';
import { Transactions } from './transactions.entity';
import { Users } from './users.entity';

@Entity({ name: TABLE.PAYMENTS, schema: 'public' })
@Index(['id'], { unique: true })
@Index(['loanId'], { unique: false })
@Index(['userId'], { unique: false })
@Index(['dueDate'], { unique: false })
export class Payments {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'bigint',
    primaryKeyConstraintName: 'payments_pkey',
  })
  id!: string;

  @Column({
    name: 'loan_id',
    type: 'bigint',
    nullable: false,
  })
  loanId!: string;

  @Column({
    name: 'user_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  userId!: string;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
  })
  amount!: string;

  @Column({
    name: 'minimum_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    default: '0.00',
  })
  minimumAmount!: string;

  @Column({
    name: 'fee',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    default: '0.00',
  })
  fee!: string;

  @Column({
    name: 'interest_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: false,
  })
  interestRate!: string;

  @Column({
    name: 'due_date',
    type: 'date',
    nullable: false,
  })
  dueDate!: string;

  @Column({
    name: 'paid_date',
    type: 'date',
    nullable: true,
  })
  paidDate?: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PaymentStatus,
  })
  status!: PaymentStatus;

  @Column({
    name: 'transaction_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  transactionId!: string;

  @ManyToOne(() => Users, (user) => user.payments)
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'userId',
    foreignKeyConstraintName: 'fk_payments_users',
  })
  user!: Users;

  @ManyToOne(() => Loans, (loan) => loan.payments)
  @JoinColumn({
    name: 'loan_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_payments_loans',
  })
  loan!: Loans;

  @OneToMany(() => Transactions, (transaction) => transaction.payment)
  transactions!: Transactions[];

  @Column(() => TimeStamp, { prefix: false })
  timestamp: TimeStamp;
}
