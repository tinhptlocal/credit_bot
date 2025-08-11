import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiMessageMention, ChannelMessage } from 'mezon-sdk';
import { Users } from 'src/entities';
import { MezonService } from 'src/shared/mezon/mezon.service';
import {
  EMessagePayloadType,
  EMessageType,
} from 'src/shared/mezon/types/mezon.type';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users) private readonly userRepository: Repository<Users>,
    private readonly mezonService: MezonService,
  ) {}

  async introduce(data: ChannelMessage) {
    const message = `👋 Hi credit ncc chao xìn. Tại đây cung cấp đủ loại khoản vay token cho mọi người thỏa sức slots`;

    await this.sendSystemMessage(data.channel_id, message, data.message_id);
  }

  async sendSystemMessage(
    channel_id: string,
    content: string,
    reply_to_message_id?: string,
    mentions?: ApiMessageMention[],
  ) {
    return this.mezonService.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id,
      payload: {
        channel_id,
        message: {
          type:
            mentions && mentions.length > 0
              ? EMessagePayloadType.NORMAL_TEXT
              : EMessagePayloadType.SYSTEM,
          content,
        },
        mentions:
          mentions?.map((m) => ({
            user_id: m.user_id,
            channel_id,
            s: m.s,
            e: m.e,
          })) || [],
      },
    });
  }
}
