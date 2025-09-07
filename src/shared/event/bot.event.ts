import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelMessage, Events, TokenSentEvent } from 'mezon-sdk';
import {
  CHECK_BALANCE_MESSAGE,
  LOANS,
  LOANS_CHECK,
  OPTION_LOAN_TERMS,
  STARTED_MESSAGE,
  STARTED_MESSAGE_WITH_BOT_NAME,
  WITH_DRAW,
} from 'src/constant';
import { TransactionService } from 'src/modules/transaction/transaction.service';
import { UserService } from 'src/modules/user/user.service';
import { MezonService } from '../mezon/mezon.service';
import { EMessagePayloadType, EMessageType } from '../mezon/types/mezon.type';
import { LoanService } from 'src/modules/loan/loan.service';

@Injectable()
export class BotEvent {
  constructor(
    private readonly userService: UserService,
    private readonly transactionService: TransactionService,
    private readonly mezonService: MezonService,
    private readonly loanService: LoanService,
  ) {}

  @OnEvent(Events.TokenSend)
  async handleTokenSentEvent(data: TokenSentEvent) {
    await this.transactionService.createToken(data);
  }

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessageEvent(data: ChannelMessage) {
    if (data.content.t === STARTED_MESSAGE_WITH_BOT_NAME) {
      await this.userService.introduce(data);
    } else if (
      data.content.t === `${STARTED_MESSAGE}${CHECK_BALANCE_MESSAGE}`
    ) {
      await this.userService.checkBalance(data);
    } else if (data.content.t?.startsWith(`${STARTED_MESSAGE}${WITH_DRAW}`)) {
      const numberInString = data.content.t.match(/\d+/);
      if (numberInString) {
        if (numberInString) {
          await this.userService.withDraw(data, String(numberInString[0]));
        }
      }
    } else if (data.content.t?.startsWith(`${STARTED_MESSAGE}${LOANS}`)) {
      await this.handleCreateLoans(data);
    } else if (data.content.t === `${STARTED_MESSAGE}${LOANS_CHECK}`) {
      await this.loanService.getLoanStatus(data);
    }
  }

  async handleCreateLoans(data: ChannelMessage) {
    if (!data.content.t) return;
    const params = data.content.t.split(' ');

    if (params.length !== 3) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              '❌ Cú pháp không đúng. Vui lòng sử dụng: $vay <số_tiền> <số_tháng>',
          },
        },
      });
      return;
    }

    const amount = parseInt(params[1]);
    const term = parseInt(params[2]);

    if (!OPTION_LOAN_TERMS.includes(term)) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: '❌ Hiện chỉ có thể vay với các kỳ hạn: 3, 6, 12 tháng.',
          },
        },
      });
      return;
    }

    await this.loanService.requestLoan(data, amount, term);
  }
}
