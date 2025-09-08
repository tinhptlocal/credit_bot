import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTableTransactionLogs1757171116463 implements MigrationInterface {
    name = 'AddTableTransactionLogs1757171116463'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "transaction_logs" ("id" BIGSERIAL NOT NULL, "transaction_id" character varying(255) NOT NULL, "amount" bigint NOT NULL, "user_id" character varying(255) NOT NULL, "created_at" TIMESTAMP DEFAULT now(), "created_by" character varying, "updated_at" TIMESTAMP DEFAULT now(), "updated_by" character varying, "deleted_at" TIMESTAMP, "deleted_by" bigint, CONSTRAINT "transactions_logs_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "minimum_amount" SET DEFAULT '0.00'`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "fee" SET DEFAULT '0.00'`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" ADD CONSTRAINT "fk_transaction_logs_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" ADD CONSTRAINT "fk_timestamp_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" ADD CONSTRAINT "fk_timestamp_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_logs" DROP CONSTRAINT "fk_timestamp_updated_by"`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" DROP CONSTRAINT "fk_timestamp_created_by"`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" DROP CONSTRAINT "fk_transaction_logs_user_id"`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "fee" SET DEFAULT 0.00`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "minimum_amount" SET DEFAULT 0.00`);
        await queryRunner.query(`DROP TABLE "transaction_logs"`);
    }

}
