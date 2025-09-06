import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiMessageMention, ChannelMessage, TokenSentEvent } from 'mezon-sdk';
import { EMPTY_BALANCE_MESSAGES } from 'src/constant';
import { Users, TransactionLogs } from 'src/entities';
import { formatVND, random } from 'src/shared/helper';
import { MezonService } from 'src/shared/mezon/mezon.service';
import {
  EMessagePayloadType,
  EMessageType,
} from 'src/shared/mezon/types/mezon.type';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users) private readonly userRepository: Repository<Users>,
    @InjectRepository(TransactionLogs)
    private readonly transactionLogsRepository: Repository<TransactionLogs>,
    private readonly mezonService: MezonService,
  ) {}

  async introduce(data: ChannelMessage) {
    const message = `👋 Hi credit ncc chao xìn. Tại đây cung cấp đủ loại khoản vay token cho mọi người thỏa sức slots`;

    await this.sendSystemMessage(data.channel_id, message, data.message_id);
  }

  async getUserByDataSdk(data: ChannelMessage) {
    const userId = data.sender_id;

    return await this.userRepository
      .createQueryBuilder('u')
      .where('u.userId = :userId', { userId })
      .getOne();
  }

  async checkBalance(data: ChannelMessage) {
    const user = await this.getUserByDataSdk(data);

    if (!user) {
      const message = random(EMPTY_BALANCE_MESSAGES);
      await this.sendSystemMessage(data.channel_id, message, data.message_id);
    } else {
      const message = `💸 Số dư của bạn là ${formatVND(Number(user.balance))}`;
      await this.sendSystemMessage(data.channel_id, message, data.message_id);
    }
  }

  async withDraw(data: ChannelMessage, amount: string) {
    const user = await this.getUserByDataSdk(data);
    const amountNumber = Number(amount);
    const userBalanceNumber = Number(user?.balance);

    if (!user || userBalanceNumber < amountNumber || amountNumber <= 0) {
      const message = `💸 Số dư của bạn không đủ để rút hoặc số tiền rút không hợp lệ, bạn hãy kiểm tra lại số tiền`;
      await this.sendSystemMessage(data.channel_id, message, data.message_id);
      return;
    }
    const transactionId = uuidv4();

    try {
      await this.mezonService.sendToken({
        user_id: data.sender_id,
        amount: amountNumber,
        note: `Rút ${formatVND(amountNumber)}`,
      });

      await Promise.all([
        await this.userRepository.update(
          { userId: data.sender_id },
          { balance: String(userBalanceNumber - amountNumber) },
        ),

        await this.transactionLogsRepository.save(
          this.transactionLogsRepository.create({
            transactionId,
            amount: `-${String(amountNumber)}`,
            userId: data.sender_id,
          }),
        ),
      ]);

      const message = `💸 Rút ${formatVND(amountNumber)} thành công`;
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: message,
          },
        },
      });
    } catch (error) {
      await this.mezonService.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: `Rút tiền không thành công. Vui lòng kiểm tra lại tài khoản nếu có mất tiền xin liên hệ với đội IT để được hỗ trợ`,
          },
        },
      });
      console.log('error', error);
    }
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
