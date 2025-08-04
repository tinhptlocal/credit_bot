import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user.entity';

export abstract class TimeStamp {
  @CreateDateColumn({
    type: 'timestamp without time zone',
    name: 'created_at',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt?: Date | null;

  @Column('bigint', { name: 'created_by', nullable: true, unique: false })
  createdById?: string | null;

  @ManyToOne(() => User)
  @JoinColumn({
    name: 'created_by',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_timestamp_created_by',
  })
  createdBy?: User | null;

  @UpdateDateColumn({
    type: 'timestamp without time zone',
    name: 'updated_at',
    nullable: true,
    default: null,
  })
  updatedAt?: Date | null;

  @Column('bigint', { name: 'updated_by', nullable: true, unique: false })
  updatedById?: string | null;

  @ManyToOne(() => User)
  @JoinColumn({
    name: 'updated_by',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_timestamp_updated_by',
  })
  updatedBy?: User | null;

  @DeleteDateColumn({
    type: 'timestamp without time zone',
    name: 'deleted_at',
    nullable: true,
  })
  deletedAt?: Date | null;

  @Column('bigint', { name: 'deleted_by', nullable: true })
  deletedById?: string | null;
}
