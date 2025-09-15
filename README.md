# Credit Bot

A financial management bot that handles loans, payments, and user transactions.

## Features

### User Commands

- `$start` - Register new account
- `$kttk` - Check account balance
- `$rut <amount>` - Withdraw money
- `$send <amount>` - Send tokens to bot

### Loan Management

- `$vay <amount> <months>` - Apply for a loan
- `$ktvay` - Check loan status
- `$dsvay` - View active loans list

### Payment Features

- `$tt` - Make a payment
- `$lstt` - View payment history
- `$ttst` - View upcoming payments
- `$ttqh` - Check overdue payments

### Admin Commands

- `$admin stats` - View system statistics
- `$admin loans` - View all loans
- `$admin users` - View all users
- `$admin balance` - Check bot's balance
- `$admin credit` - Adjust user credit scores
- `$admin approve/reject` - Process loan applications

## Installation

1. Clone the repository:

```bash
git clone https://github.com/tinhptlocal/credit_bot
```

2. Install dependencies:

```bash
yarn
```

3. Set up environment variables:

```bash
cp .env.example .env
```

4. Configure the following in .env:

- BOT_TOKEN
- BOT_NAME
- BOT_ID
- Database credentials
- Redis configuration

5. Run database migrations:

```bash
yarn migration:run
```

6. Start the bot:

```bash
yarn start:dev
```

## Deployment

For production deployment:

```bash
yarn build
yarn start
```

## Requirements

- Node.js 16+
- PostgreSQL
- Redis

## Support

For support and issues, please open an issue in the repository.

## License

[MIT licensed](LICENSE)
