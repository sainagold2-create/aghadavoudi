export type SmsSendInput = {
  phone: string;
  body: string;
  idempotencyKey: string;
  templateKey: string;
  orderId?: string;
};

export interface SmsService {
  enqueue(input: SmsSendInput): Promise<void>;
  processQueue(limit?: number): Promise<number>;
}
