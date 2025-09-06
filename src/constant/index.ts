import { ENV } from 'src/config';

export const BOT_NAME = ENV.BOT.NAME;
export const STARTED_MESSAGE = '$';
export const STARTED_MESSAGE_WITH_BOT_NAME = `${STARTED_MESSAGE}${BOT_NAME}`;
export const CHECK_BALANCE_MESSAGE = 'kttk';
export const WITH_DRAW = 'rut';

export const EMPTY_BALANCE_MESSAGES = [
  `Pay more for love!`,
  'Top up your balance to continue using our services!',
  'Your balance is zero, please recharge to continue!',
  'Insufficient funds! Please add more credits to your account.',
  'Your balance is empty. Please top up to keep using our services.',
  'Looks like your balance is running low. Please recharge to continue!',
  'Your account balance is zero. Please add funds to keep using our services.',
  'You have no credits left. Please top up to continue using our services.',
  'Your balance has reached zero. Please recharge to keep using our services.',
  'Insufficient balance! Please add more credits to your account to continue.',
];
