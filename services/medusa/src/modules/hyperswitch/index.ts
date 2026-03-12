import {
  AbstractPaymentProvider,
  PaymentProviderError,
  PaymentProviderSessionResponse,
  CreatePaymentProviderSession,
  UpdatePaymentProviderSession,
  ProviderWebhookPayload,
  WebhookActionResult,
  PaymentSessionStatus,
} from '@medusajs/utils';
import { createLogger } from '@platform/shared-utils';

const logger = createLogger('medusa:hyperswitch-provider');

type HyperswitchOptions = {
  apiKey: string;
  baseUrl: string;
  webhookSecret: string;
  paymentServiceUrl?: string;
};

export default class HyperswitchPaymentProvider extends AbstractPaymentProvider<HyperswitchOptions> {
  static identifier = 'hyperswitch';

  private paymentServiceUrl: string;
  private apiKey: string;

  constructor(container: Record<string, unknown>, options: HyperswitchOptions) {
    super(container, options);
    // Delegate to our custom Payment Service instead of calling Hyperswitch directly
    this.paymentServiceUrl = options.paymentServiceUrl
      ?? process.env.PAYMENT_SERVICE_URL
      ?? 'http://payment-service:3001';
    this.apiKey = options.apiKey;
  }

  // Called when customer reaches checkout — creates payment session
  async initiatePayment(
    data: CreatePaymentProviderSession
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
    try {
      const { amount, currency_code, context } = data;

      const response = await fetch(
        `${this.paymentServiceUrl}/payment-intents`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.generateServiceToken()}`,
            'X-Identity-Type': 'service',
          },
          body: JSON.stringify({
            orderId: context.resource_id ?? 'medusa_cart',
            customerId: context.customer?.id ?? 'guest',
            amount: amount,
            currency: currency_code.toUpperCase(),
          }),
        }
      );

      const result = await response.json() as {
        success: boolean;
        data: { id: string; clientSecret: string; hyperswitchPaymentId: string };
      };

      if (!result.success) throw new Error('Payment initiation failed');

      return {
        id: result.data.id,
        data: {
          paymentIntentId: result.data.id,
          clientSecret: result.data.clientSecret,
          hyperswitchPaymentId: result.data.hyperswitchPaymentId,
        },
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Payment initiation failed',
        code: 'INITIATION_FAILED',
        detail: err,
      };
    }
  }

  // Called when customer submits payment — authorizes the payment
  async authorizePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentProviderError | { data: Record<string, unknown>; status: PaymentSessionStatus }> {
    try {
      const { paymentIntentId } = paymentSessionData;

      const response = await fetch(
        `${this.paymentServiceUrl}/payment-intents/${paymentIntentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.generateServiceToken()}`,
            'X-Identity-Type': 'service',
          },
        }
      );

      const result = await response.json() as {
        success: boolean;
        data: { status: string };
      };

      const status = this.mapToMedusaStatus(result.data.status);

      return { data: paymentSessionData, status };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Authorization failed',
        code: 'AUTHORIZATION_FAILED',
        detail: err,
      };
    }
  }

  // Called when order is cancelled — cancels the payment intent
  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentProviderError | Record<string, unknown>> {
    try {
      const { paymentIntentId } = paymentSessionData;

      await fetch(
        `${this.paymentServiceUrl}/payment-intents/${paymentIntentId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.generateServiceToken()}`,
            'X-Identity-Type': 'service',
          },
        }
      );

      return paymentSessionData;
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Cancellation failed',
        code: 'CANCELLATION_FAILED',
        detail: err,
      };
    }
  }

  // Called for refunds through Medusa admin
  async refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<PaymentProviderError | Record<string, unknown>> {
    try {
      const { paymentIntentId } = paymentSessionData;

      await fetch(
        `${this.paymentServiceUrl}/payment-intents/${paymentIntentId}/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.generateServiceToken()}`,
            'X-Identity-Type': 'service',
          },
          body: JSON.stringify({ amount: refundAmount }),
        }
      );

      return paymentSessionData;
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Refund failed',
        code: 'REFUND_FAILED',
        detail: err,
      };
    }
  }

  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentProviderError | Record<string, unknown>> {
    return paymentSessionData;
  }

  async updatePayment(
    data: UpdatePaymentProviderSession
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
    return { id: data.data.id as string, data: data.data };
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentProviderError | Record<string, unknown>> {
    return this.cancelPayment(paymentSessionData);
  }

  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    const { status } = paymentSessionData;
    return this.mapToMedusaStatus(status as string);
  }

  // Handle webhooks forwarded from our Webhook Service
  async getWebhookActionAndData(
    webhookData: ProviderWebhookPayload
  ): Promise<WebhookActionResult> {
    const { data } = webhookData.payload;
    const obj = (data as any)?.object ?? {};

    return {
      action: this.mapEventToAction((webhookData.payload as any).event_type),
      data: {
        session_id: obj.payment_id,
        amount: obj.amount,
      },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private mapToMedusaStatus(hsStatus: string): PaymentSessionStatus {
    const map: Record<string, PaymentSessionStatus> = {
      succeeded: 'authorized',
      processing: 'pending',
      requires_action: 'requires_more',
      failed: 'error',
      cancelled: 'canceled',
      requires_payment_method: 'pending',
      requires_confirmation: 'pending',
    };
    return map[hsStatus] ?? 'pending';
  }

  private mapEventToAction(eventType: string): string {
    const map: Record<string, string> = {
      'payment_intent.succeeded': 'authorized',
      'payment_intent.failed': 'failed',
      'payment_intent.cancelled': 'canceled',
      'refund.succeeded': 'refunded',
    };
    return map[eventType] ?? 'not_supported';
  }

  private generateServiceToken(): string {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { type: 'service', service: 'medusa' },
      process.env.INTERNAL_SERVICE_SECRET,
      { expiresIn: '60s' }
    );
  }
}
