import { TABLE } from 'src/types';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimeStamp } from './timestamp';

@Entity({ name: TABLE.USERS, schema: 'public' })
@Index(['userId'], { unique: true })
export class User {
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

  @Column(() => TimeStamp, { prefix: false })
  timestamp: TimeStamp;
}
