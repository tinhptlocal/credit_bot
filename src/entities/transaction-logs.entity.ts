import { TABLE } from 'src/types';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TimeStamp } from './timestamp';
import { Users } from './users.entity';

@Entity({ name: TABLE.TRANSACTION_LOGS, schema: 'public' })
export class TransactionLogs {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'bigint',
    primaryKeyConstraintName: 'transactions_logs_pkey',
  })
  id!: string;

  @Column({
    name: 'transaction_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  transactionId!: string;

  @Column({
    name: 'amount',
    type: 'bigint',
    nullable: false,
  })
  amount!: string;

  @Column({
    name: 'user_id',
    type: 'varchar',
    length: 255,
  })
  userId?: string;

  @ManyToOne(() => Users, (user) => user.transactionsLogs)
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'userId',
    foreignKeyConstraintName: 'fk_transaction_logs_user_id',
  })
  user?: Users;

  @Column(() => TimeStamp, { prefix: false })
  timestamp: TimeStamp;
}
