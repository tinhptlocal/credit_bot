import { ENV } from 'src/config';

export const BOT_NAME = ENV.BOT.NAME;
export const STARTED_MESSAGE = '$';
export const STARTED_MESSAGE_WITH_BOT_NAME = `${STARTED_MESSAGE}${BOT_NAME}`;
export const CHECK_BALANCE_MESSAGE = 'kttk';
export const WITH_DRAW = 'rut';
export const LOANS = 'vay';
export const LOANS_CHECK = 'ktvay';
export const LOANS_LIST = 'dsvay'; // danh sách khoản vay đang hoạt động
export const CHECK_LOAN_ACTICE = 'loan_check';
export const PAYMENT_CHECK_SCHEDULE = 'credit_check';
export const SEND_TO_BOT = 'send';

// Payment commands
export const PAYMENT_HISTORY = 'lstt'; // lịch sử thanh toán
export const PAYMENT_UPCOMING = 'ttst'; // thanh toán sắp tới
export const PAYMENT_PAY = 'tt'; // thanh toán
export const PAYMENT_OVERDUE = 'ttqh'; // thanh toán quá hạn
export const PAYMENT_LIST = 'dstt'; // danh sách tất cả thanh toán
export const PAYMENT_EARLY = 'tth'; // thanh toán trước hạn (toàn bộ loan)
export const PAYMENT_CONFIRM = 'xntt'; // xác nhận thanh toán trước hạn

// Help Commands
export const HELP = 'help'; // hiển thị hướng dẫn sử dụng

// Admin Commands
export const ADMIN_PREFIX = `${STARTED_MESSAGE}admin`;
export const ADMIN_KICK = 'kick';
export const ADMIN_WARN = 'warn';
export const ADMIN_STATS = 'stats';
export const ADMIN_LOANS = 'loans';
export const ADMIN_APPROVE = 'approve';
export const ADMIN_REJECT = 'reject';
export const ADMIN_USERS = 'users';
export const ADMIN_CREDIT = 'credit';
export const ADMIN_FIND = 'find';
export const ID_ADMIN1 = '1840669672182124544';
export const ID_ADMIN2 = '1840669672182124544';
export const ADMIN_BALANCE = 'balance';
export const ADMIN_GENERATE_PAYMENTS = 'genpay';
export const ADMIN_WITHDRAW = 'withdraw';
export const ADD_ADMIN = 'add';
export const ID_ADMIN3 = '1930090353453436928';

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

export const OPTION_LOAN_TERMS = [3, 6, 9, 12]; // in months

export const MAX_LOAN_AMOUNTS = 1000000; // Maximum loan amount is 1,000,000 VND
