import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TimeStamp } from './timestamp';
import { Users } from './users.entity';
import { LoanStatus } from 'src/types';
import { Transactions } from './transactions.entity';
import { Payments } from './payments.entity';

@Entity({ name: 'loans', schema: 'public' })
@Index(['id'], { unique: true })
@Index(['userId'], { unique: false })
@Index(['endDate'], { unique: false })
export class Loans {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'bigint',
    primaryKeyConstraintName: 'loans_pkey',
  })
  id!: string;

  @Column({
    name: 'amount',
    type: 'bigint',
  })
  amount!: string;

  @Column({
    name: 'interest_rate',
    type: 'integer',
    nullable: false,
  })
  interstRate!: number;

  @Column({
    name: 'term',
    type: 'integer',
    nullable: false,
  })
  term!: number;

  @Column({
    name: 'start_date',
    type: 'timestamp without time zone',
    nullable: true,
  })
  startDate!: Date;

  @Column({
    name: 'end_date',
    type: 'timestamp without time zone',
    nullable: true,
  })
  endDate!: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: LoanStatus,
    nullable: false,
  })
  status!: LoanStatus;

  @Column({
    name: 'user_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  userId!: string;

  @ManyToOne(() => Users, (user) => user.loans)
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'userId',
    foreignKeyConstraintName: 'fk_loans_user_id',
  })
  user!: Users;

  @OneToMany(() => Transactions, (transaction) => transaction.loan)
  transactions: Transactions[];

  @OneToMany(() => Payments, (payment) => payment.loan)
  payments: Payments[];

  @Column(() => TimeStamp, { prefix: false })
  timestamp: TimeStamp;
}
