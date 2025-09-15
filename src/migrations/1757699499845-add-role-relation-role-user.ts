import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleRelationRoleUser1757699499845
  implements MigrationInterface
{
  name = 'AddRoleRelationRoleUser1757699499845';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        INSERT INTO "roles" ("name", "created_at", "updated_at", "created_by", "updated_by")
        VALUES ('admin', NOW(), NOW(), '1930090353453436928', '1930090353453436928')
        ON CONFLICT ("name") DO NOTHING
        RETURNING id;
    `);

    await queryRunner.query(`
        INSERT INTO "roles" ("name", "created_at", "updated_at", "created_by", "updated_by")
        VALUES ('user', NOW(), NOW(), '1930090353453436928', '1930090353453436928')
        ON CONFLICT ("name") DO NOTHING
        RETURNING id;
    `);

    // Get role IDs
    const adminRole = await queryRunner.query(`
        SELECT id FROM "roles" WHERE name = 'admin' LIMIT 1;
    `);

    const userRole = await queryRunner.query(`
        SELECT id FROM "roles" WHERE name = 'user' LIMIT 1;
    `);

    await queryRunner.query(
      `
        INSERT INTO "user_roles" ("user_id", "role_id")
        VALUES (
          '1930090353453436928',
          $1
        )
        ON CONFLICT DO NOTHING;
    `,
      [adminRole[0].id],
    );

    await queryRunner.query(
      `
        INSERT INTO "user_roles" ("user_id", "role_id")
        VALUES (
          '1930090353453436928',
          $1
        )
        ON CONFLICT DO NOTHING;
    `,
      [userRole[0].id],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_roles"
      WHERE "user_id" = '1930090353453436928';
    `);

    await queryRunner.query(`
      DELETE FROM "roles"
      WHERE "name" IN ('admin', 'user');
    `);
  }
}
