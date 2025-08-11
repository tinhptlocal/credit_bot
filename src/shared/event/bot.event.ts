import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelMessage, Events } from 'mezon-sdk';
import { STARTED_MESSAGE_WITH_BOT_NAME } from 'src/constant';
import { UserService } from 'src/modules/user/user.service';

@Injectable()
export class BotEvent {
  constructor(private readonly userService: UserService) {}

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessageEvent(data: ChannelMessage) {
    if (data.content.t === STARTED_MESSAGE_WITH_BOT_NAME) {
      await this.userService.introduce(data);
    }
  }
}
