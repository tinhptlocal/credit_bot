import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1754555529166 implements MigrationInterface {
  name = 'Init1754555529166';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'paid', 'overdue', 'minimum_paid')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" BIGSERIAL NOT NULL, "loan_id" bigint NOT NULL, "user_id" character varying(255) NOT NULL, "amount" numeric(15,2) NOT NULL, "minimum_amount" numeric(15,2) DEFAULT '0.00', "fee" numeric(15,2) DEFAULT '0.00', "interest_rate" numeric(5,2) NOT NULL, "due_date" date NOT NULL, "paid_date" date, "status" "public"."payments_status_enum" NOT NULL, "transaction_id" character varying(255) NOT NULL, "created_at" TIMESTAMP DEFAULT now(), "created_by" character varying, "updated_at" TIMESTAMP DEFAULT now(), "updated_by" character varying, "deleted_at" TIMESTAMP, "deleted_by" bigint, CONSTRAINT "payments_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a47f6250d443f80406e83df63" ON "payments" ("due_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_427785468fb7d2733f59e7d7d3" ON "payments" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a150bed3d0ff42298b5044c402" ON "payments" ("loan_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_197ab7af18c93fbb0c9b28b4a5" ON "payments" ("id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('payment', 'refund', 'fee', 'interest', 'principal', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" BIGSERIAL NOT NULL, "transaction_id" character varying(255) NOT NULL, "status" character varying(50) NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "amount" bigint NOT NULL, "loan_id" bigint NOT NULL, "user_id" character varying(255) NOT NULL, "payment_id" bigint, "created_at" TIMESTAMP DEFAULT now(), "created_by" character varying, "updated_at" TIMESTAMP DEFAULT now(), "updated_by" character varying, "deleted_at" TIMESTAMP, "deleted_by" bigint, CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9162bf9ab4e31961a8f7932974" ON "transactions" ("transaction_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."loans_status_enum" AS ENUM('pending', 'approved', 'repaid', 'overdue', 'due', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "loans" ("id" BIGSERIAL NOT NULL, "amount" bigint NOT NULL, "interest_rate" integer NOT NULL, "term" integer NOT NULL, "start_date" TIMESTAMP, "end_date" TIMESTAMP, "status" "public"."loans_status_enum" NOT NULL, "user_id" character varying(255) NOT NULL, "created_at" TIMESTAMP DEFAULT now(), "created_by" character varying, "updated_at" TIMESTAMP DEFAULT now(), "updated_by" character varying, "deleted_at" TIMESTAMP, "deleted_by" bigint, CONSTRAINT "loans_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d1ac18806b6637ddaf495ad0c" ON "loans" ("end_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d135791c39e46e13ca4c2725fb" ON "loans" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5c6942c1e13e4de135c5203ee6" ON "loans" ("id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" BIGSERIAL NOT NULL, "name" character varying(50) NOT NULL, "created_at" TIMESTAMP DEFAULT now(), "created_by" character varying, "updated_at" TIMESTAMP DEFAULT now(), "updated_by" character varying, "deleted_at" TIMESTAMP, "deleted_by" bigint, CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "roles_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_roles" ("id" BIGSERIAL NOT NULL, "user_id" character varying(255) NOT NULL, "role_id" bigint NOT NULL, CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" BIGSERIAL NOT NULL, "username" character varying(255) NOT NULL, "user_id" character varying(255) NOT NULL, "balance" bigint NOT NULL, "credit_score" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP DEFAULT now(), "created_by" character varying, "updated_at" TIMESTAMP DEFAULT now(), "updated_by" character varying, "deleted_at" TIMESTAMP, "deleted_by" bigint, CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_96aac72f1574b88752e9fb00089" UNIQUE ("user_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_96aac72f1574b88752e9fb0008" ON "users" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_users" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_loans" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "fk_timestamp_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "fk_timestamp_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "fk_transaction_loan_id" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "fk_transaction_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "fk_transaction_payment_id" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "fk_timestamp_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "fk_timestamp_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD CONSTRAINT "fk_loans_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD CONSTRAINT "fk_timestamp_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" ADD CONSTRAINT "fk_timestamp_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "fk_timestamp_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "fk_timestamp_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "fk_role_roles_user" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "fk_timestamp_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "fk_timestamp_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "fk_timestamp_updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "fk_timestamp_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "fk_role_roles_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" DROP CONSTRAINT "fk_timestamp_updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" DROP CONSTRAINT "fk_timestamp_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP CONSTRAINT "fk_timestamp_updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP CONSTRAINT "fk_timestamp_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loans" DROP CONSTRAINT "fk_loans_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "fk_timestamp_updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "fk_timestamp_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "fk_transaction_payment_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "fk_transaction_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "fk_transaction_loan_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "fk_timestamp_updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "fk_timestamp_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "fk_payments_loans"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "fk_payments_users"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_96aac72f1574b88752e9fb0008"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5c6942c1e13e4de135c5203ee6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d135791c39e46e13ca4c2725fb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8d1ac18806b6637ddaf495ad0c"`,
    );
    await queryRunner.query(`DROP TABLE "loans"`);
    await queryRunner.query(`DROP TYPE "public"."loans_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9162bf9ab4e31961a8f7932974"`,
    );
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_197ab7af18c93fbb0c9b28b4a5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a150bed3d0ff42298b5044c402"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_427785468fb7d2733f59e7d7d3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a47f6250d443f80406e83df63"`,
    );
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
  }
}
