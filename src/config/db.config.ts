import { DataSource } from 'typeorm';
import { ENV } from './env.config';
import { config } from 'dotenv';
import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

config();

// Update the entities path in the DataSource configuration
export default new DataSource({
  type: 'postgres',
  host: ENV.DATABASE.HOST,
  port: ENV.DATABASE.PORT,
  username: ENV.DATABASE.USERNAME,
  password: ENV.DATABASE.PASSWORD,
  database: ENV.DATABASE.DATABASE,
  entities: ['dist/**/entities/*.entity.js'], // Changed from src to dist and .ts to .js
  migrations: ['dist/migrations/*.js'], // Changed from src to dist and .ts to .js
  logging: false,
  synchronize: false,
});

@Injectable()
export class PostgresConfiguration implements TypeOrmOptionsFactory {
  constructor() {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: ENV.DATABASE.HOST,
      port: ENV.DATABASE.PORT,
      username: ENV.DATABASE.USERNAME,
      password: ENV.DATABASE.PASSWORD,
      database: ENV.DATABASE.DATABASE,
      entities: ['dist/**/entities/*.entity.js'], // Changed from src to dist and .ts to .js
      migrations: ['dist/migrations/*.js'], // Changed from src to dist and .ts to .js
      logging: true,
      logger: 'advanced-console',
      synchronize: false,
    };
  }
}
