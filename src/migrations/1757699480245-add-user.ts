import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUser1757699480245 implements MigrationInterface {
  name = 'AddUser1757699480245';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "users" (
        "username",
        "user_id",
        "balance",
        "credit_score",
        "created_at",
        "updated_at"
      )
      VALUES (
        'tinh.phamthe',
        '1930090353453436928',
        0,
        100,
        NOW(),
        NOW()
      )
      ON CONFLICT ("user_id") DO NOTHING
      RETURNING user_id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "users"
      WHERE "user_id" = '1930090353453436928';
    `);
  }
}
