import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Msg91Response = {
  request_id?: unknown;
  type?: unknown;
  status?: unknown;
  message?: unknown;
  errors?: unknown;
  code?: unknown;
  apiError?: unknown;
  hasError?: unknown;
};

@Injectable()
export class ConsoleOtpProvider {
  private readonly logger = new Logger(ConsoleOtpProvider.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(mobileNumber: string, otp: string): Promise<void> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    const flowId =
      this.config.get<string>('MSG91_FLOW_ID') ||
      this.config.get<string>('MSG91_TEMPLATE_ID');
    const senderId = this.config.get<string>('MSG91_SENDER_ID');

    if (authKey && flowId && senderId) {
      const response = await fetch('https://api.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          authkey: authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow_id: flowId,
          sender: senderId,
          recipients: [
            {
              mobiles: `91${mobileNumber}`,
              number: otp,
            },
          ],
        }),
      });
      const result = (await response.json().catch(() => undefined)) as
        | Msg91Response
        | undefined;
      const succeeded =
        result?.hasError !== true &&
        (result?.type === 'success' || result?.status === 'success');

      if (!response.ok || !succeeded) {
        const providerCode = result?.apiError ?? result?.code;
        const providerMessage = result?.errors ?? result?.message;
        const detail = [
          providerCode === undefined ? undefined : `code=${String(providerCode)}`,
          providerMessage === undefined
            ? undefined
            : `message=${String(providerMessage)}`,
        ]
          .filter(Boolean)
          .join(', ');

        this.logger.error(
          `MSG91 OTP delivery failed: ${detail || response.statusText || 'invalid provider response'}`,
        );
        throw new BadGatewayException(
          'OTP delivery is temporarily unavailable',
        );
      }
      this.logger.log(
        `MSG91 accepted OTP request${
          typeof result?.message === 'string'
            ? `: request_id=${result.message}`
            : ''
        }`,
      );
      return;
    }

    this.logger.log(`Local OTP for ${mobileNumber}: ${otp}`);
  }
}
