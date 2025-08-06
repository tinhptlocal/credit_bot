import { TABLE, TransactionType } from 'src/types';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Loans } from './loans.entity';
import { Payments } from './payments.entity';
import { TimeStamp } from './timestamp';
import { Users } from './users.entity';

@Entity({ name: TABLE.TRANSACTIONS, schema: 'public' })
@Index(['transactionId'], { unique: true })
export class Transactions {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'bigint',
    primaryKeyConstraintName: 'transactions_pkey',
  })
  id!: string;

  @Column({
    name: 'transaction_id',
    type: 'character varying',
    length: 255,
    nullable: false,
  })
  transactionId!: string;

  @Column({
    name: 'status',
    type: 'character varying',
    length: 50,
    nullable: false,
  })
  status!: string;

  @Column({
    name: 'type',
    type: 'enum',
    length: 50,
    nullable: false,
  })
  type!: TransactionType;

  @Column({
    name: 'amount',
    type: 'bigint',
    nullable: false,
  })
  amount!: string;

  @Column({
    name: 'loan_id',
    type: 'character varying',
    length: 255,
    nullable: false,
  })
  loanId!: string;

  @ManyToOne(() => Loans, (loan) => loan.transactions)
  @JoinColumn({
    name: 'loan_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_transaction_loan_id',
  })
  loan: Loans;

  @Column({
    name: 'user_id',
    type: 'character varying',
    length: 255,
  })
  userId?: string;

  @ManyToOne(() => Users, (user) => user.transactions)
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'userId',
    foreignKeyConstraintName: 'fk_transaction_user_id',
  })
  user?: Users;

  @Column({
    name: 'payment_id',
    type: 'character varying',
    length: 255,
    nullable: true,
  })
  paymentId?: string;

  @ManyToOne(() => Loans, (loan) => loan.transactions)
  @JoinColumn({
    name: 'payment_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_transaction_payment_id',
  })
  payment?: Payments;

  @Column(() => TimeStamp, { prefix: false })
  timestamp: TimeStamp;
}
