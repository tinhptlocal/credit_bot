# Credit Bot

A financial management Discord bot that provides automated loan services, payment processing, and credit scoring. The bot helps manage lending operations with features like loan applications, payment tracking, and credit assessment.

## Overview

Credit Bot streamlines lending operations by:

- Managing user loan applications and approvals
- Tracking payment schedules and reminders
- Handling automated payments and withdrawals
- Maintaining credit scores for users
- Monitoring overdue payments and penalties

## Key Features

### User Financial Management

- Account registration and balance checking
- Token deposits and withdrawals
- Credit score tracking
- Transaction history viewing

### Loan Services

- Multiple loan term options (3, 6, 9, 12 months)
- Automated loan approval process
- Interest rate calculation based on credit score
- Early payment options with interest savings
- Payment schedule generation

### Payment Processing

- Automated payment tracking
- Multiple payment options
- Early payment discounts
- Overdue payment penalties
- Payment history tracking

### Administrative Tools

- System statistics monitoring
- User management
- Loan approval/rejection
- Credit score adjustment
- Treasury balance monitoring
- Payment schedule management

## Technical Architecture

- **Backend**: NestJS (Node.js framework)
- **Database**: PostgreSQL for data persistence
- **Caching**: Redis for performance optimization
- **Integration**: Mezon SDK for messaging
- **Scheduling**: Automated reminders and notifications

## Security Features

- Secure token transactions
- Admin role management
- Transaction logging
- Rate limiting
- Error handling and validation

## Benefits

- **For Users**:
  - Easy loan applications
  - Flexible payment options
  - Credit score improvement opportunities
  - Clear payment schedules
  - Automated reminders

- **For Administrators**:
  - Centralized loan management
  - Automated payment tracking
  - Risk assessment tools
  - System performance monitoring
  - User activity tracking

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
