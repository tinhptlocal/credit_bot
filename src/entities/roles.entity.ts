import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserRoles } from './user-roles.entity';
import { TimeStamp } from './timestamp';
import { TABLE } from 'src/types';

@Entity({ name: TABLE.ROLES, schema: 'public' })
export class Roles {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'bigint',
    primaryKeyConstraintName: 'roles_pkey',
  })
  id!: string;

  @Column({
    name: 'name',
    type: 'varchar',
    length: 50,
    nullable: false,
    unique: true,
  })
  name!: string;

  @OneToMany(() => UserRoles, (userRole) => userRole.role)
  userRoles: UserRoles[];

  @Column(() => TimeStamp, { prefix: false })
  timestamp: TimeStamp;
}
