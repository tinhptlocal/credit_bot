import { config } from 'dotenv';

config();

export const ENV = {
  APP_PORT: process.env.APP_PORT ?? 3000,

  DATABASE: {
    HOST: process.env.DB_HOST,
    PORT: Number(process.env.DB_PORT),
    USERNAME: process.env.DB_USER,
    PASSWORD: process.env.DB_PASS,
    DATABASE: process.env.DB_NAME,
  },

  REDIS: {
    HOST: process.env.REDIS_HOST,
    PORT: Number(process.env.REDIS_PORT),
  },

  BOT: {
    TOKEN: process.env.BOT_TOKEN,
    NAME: process.env.BOT_NAME ?? 'credit',
    ID: process.env.BOT_ID,
  },
};
