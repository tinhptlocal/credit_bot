import { ENV } from 'src/config';

export const BOT_NAME = ENV.BOT.NAME;
export const STARTED_MESSAGE = '$';
export const STARTED_MESSAGE_WITH_BOT_NAME = `${STARTED_MESSAGE}${BOT_NAME}`;
