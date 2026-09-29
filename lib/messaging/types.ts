export type SendTextInput = {
  destination: string;
  text: string;
  idempotencyKey: string;
};

export type SendMediaInput = SendTextInput & {
  mediaUrl: string;
  fileName: string;
  mimeType: string;
};

export type SendResult =
  | { success: true; externalId?: string }
  | { success: false; error: string };

export interface MessagingProvider {
  sendText(input: SendTextInput): Promise<SendResult>;
  sendMedia(input: SendMediaInput): Promise<SendResult>;
  health(): Promise<{ gateway: boolean; whatsapp: string; detail?: string }>;
}
