import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelMessage, Events, TokenSentEvent } from 'mezon-sdk';
import {
  CHECK_BALANCE_MESSAGE,
  STARTED_MESSAGE,
  STARTED_MESSAGE_WITH_BOT_NAME,
  WITH_DRAW,
} from 'src/constant';
import { TransactionService } from 'src/modules/transaction/transaction.service';
import { UserService } from 'src/modules/user/user.service';

@Injectable()
export class BotEvent {
  constructor(
    private readonly userService: UserService,
    private readonly transactionService: TransactionService,
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
    }
  }
}
