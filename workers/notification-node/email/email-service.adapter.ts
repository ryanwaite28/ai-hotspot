import type { JsonObject } from '../../../packages/contracts/src/json-types';

export interface SendTemplateInput {
  recipient: string;
  templateId: string;
  templateParams: JsonObject;
}

export interface EmailService {
  sendTemplate(input: SendTemplateInput): Promise<void>;
}

export class ConsoleEmailServiceAdapter implements EmailService {
  async sendTemplate(input: SendTemplateInput): Promise<void> {
    const payload = {
      recipient: input.recipient,
      templateId: input.templateId,
      templateParams: input.templateParams,
    };
    console.info('email.sendTemplate', payload);
  }
}
