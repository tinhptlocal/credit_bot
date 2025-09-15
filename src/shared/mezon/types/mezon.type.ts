import {
  ChannelMessageContent,
  ApiMessageAttachment,
  ApiMessageMention,
} from 'mezon-sdk';
import { TokenSentEvent } from 'mezon-sdk/dist/cjs/api/api';

export type MezonSendMessageBase = {
  type: EMessageType.CHANNEL | EMessageType.DM;
  reply_to_message_id?: string;
};

export type MezonSendChannelMessage = MezonSendMessageBase & {
  clan_id?: string;
  type: EMessageType.CHANNEL;
  payload: {
    channel_id: string;
    message: MezonPayloadContent;
    images?: (string | ApiMessageAttachment)[];
    mentions?: ApiMessageMention[];
  };
};

export type MezonSendDMMessage = MezonSendMessageBase & {
  type: EMessageType.DM;
  payload: {
    clan_id: string;
    user_id: string;
    message: MezonPayloadContent;
    images?: (string | ApiMessageAttachment)[];
    mentions?: ApiMessageMention[];
  };
};

export type MezonEmphemeralMessage = MezonSendMessageBase & {
  clan_id?: string;
  type: EMessageType.CHANNEL;
  payload: {
    channel_id: string;
    message: MezonPayloadContent;
    images?: (string | ApiMessageAttachment)[];
    mentions?: ApiMessageMention[];
  };
};

export enum EMessageType {
  DM = 'dm',
  SYSTEM = 'system',
  CHANNEL = 'channel',
}

export enum EMessagePayloadType {
  NORMAL_TEXT = 'normal_text',
  SYSTEM = 'system',
  OPTIONAL = 'optional',
}

export type MezonPayloadContent =
  | {
      type: EMessagePayloadType.NORMAL_TEXT;
      content: string;
    }
  | {
      type: EMessagePayloadType.SYSTEM;
      content: string;
    }
  | {
      type: EMessagePayloadType.OPTIONAL;
      content: ChannelMessageContent;
    };

export type MezonSendMessage = MezonSendChannelMessage | MezonSendDMMessage;

export type MezonUpdateMessage = {
  clan_id?: string;
  channel_id: string;
  message_id: string;
  content: MezonPayloadContent;
  mentions?: {
    user_id: string;
    username?: string;
  }[];
};

export type MezonSendToken = {
  user_id: string;
  amount: number;
  note?: string;
};

interface TokenSentEventI extends TokenSentEvent {
  user_id: string;
  amount: number;
  transaction_id: string;
}

interface MessageButtonClickedEvent {
  message_id: string;
  channel_id: string;
  button_id: string;
  sender_id: string;
  user_id: string;
  extra_data: string;
}

export { TokenSentEventI, MessageButtonClickedEvent };
