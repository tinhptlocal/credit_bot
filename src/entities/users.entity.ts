import { TABLE } from 'src/types';
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
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
  })
  id!: string;

  @Column({
    name: 'username',
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
  })
  username!: string;

  @Column({
    name: 'user_id',
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
  })
  userId!: string;

  @Column({
    name: 'balance',
    type: 'bigint',
    nullable: false,
  })
  balance!: string;

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
