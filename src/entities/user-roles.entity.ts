import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Roles } from './roles.entity';
import { Users } from './users.entity';
import { TABLE } from 'src/types';

@Entity({ name: TABLE.USER_ROLES, schema: 'public' })
export class UserRoles {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'bigint',
    primaryKeyConstraintName: 'user_roles_pkey',
  })
  id!: string;

  @Column({
    name: 'user_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  userId!: string;

  @Column({
    name: 'role_id',
    type: 'bigint',
    nullable: false,
  })
  roleId!: string;

  @ManyToOne(() => Roles, (role) => role.userRoles)
  @JoinColumn({
    name: 'role_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_role_roles_user',
  })
  role!: Roles;

  @ManyToOne(() => Users, (user) => user.userRoles)
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'userId',
    foreignKeyConstraintName: 'fk_user_roles_user',
  })
  user!: Users;
}
