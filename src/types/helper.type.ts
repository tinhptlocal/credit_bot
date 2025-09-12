export enum ButtonKey {
  ACCEPT = 'accept',
  REJECT = 'reject',
  CANCEL = 'cancel',
  CONFIRM = 'confirm',
  DENY = 'deny',
  YES = 'yes',
  NO = 'no',
}

export interface ButtonConfig {
  id: string;
  label: string;
  style?: number;
}

export interface MessageButton {
  key: ButtonKey;
  label: string;
  style?: number;
}
