import { TABLE } from 'src/types';
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Loans } from './loans.entity';
import { Payments } from './payments.entity';
import { TimeStamp } from './timestamp';
import { Transactions } from './transactions.entity';
import { UserRoles } from './user-roles.entity';

@Entity({ name: TABLE.USERS, schema: 'public' })
@Index(['userId'], { unique: true })
export class Users {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'bigint',
    primaryKeyConstraintName: 'users_pkey',
  })
  id!: string;

  @Column({
    name: 'username',
    type: 'character varying',
    length: 255,
    nullable: false,
    unique: true,
  })
  username!: string;

  @Column({
    name: 'user_id',
    type: 'character varying',
    length: 255,
    nullable: false,
  })
  userId!: string;

  @Column({
    name: 'balance',
    type: 'bigint',
    length: 255,
    nullable: false,
  })
  password!: string;

  @Column({
    name: 'credit_score',
    type: 'integer',
    nullable: false,
    default: 0,
  })
  creditScore!: number;

  @OneToMany(() => Loans, (loan) => loan.user)
  loans: Loans[];

  @OneToMany(() => Transactions, (transaction) => transaction.user)
  transactions: Transactions[];

  @OneToMany(() => UserRoles, (userRoles) => userRoles.user)
  userRoles: UserRoles[];

  @OneToMany(() => Payments, (payment) => payment.user)
  payments: Payments[];

  @Column(() => TimeStamp, { prefix: false })
  timestamp: TimeStamp;
}
