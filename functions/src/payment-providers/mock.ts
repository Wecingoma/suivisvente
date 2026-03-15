import type {
  CreatePaymentSessionInput,
  PaymentProvider,
  PaymentSessionResult,
  PaymentWebhookEvent,
} from "./base.js"

export class MockPaymentProvider implements PaymentProvider {
  async createSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult> {
    const providerSessionId = `mock_${crypto.randomUUID()}`

    return {
      providerSessionId,
      providerReference: providerSessionId,
      checkoutUrl: `${input.returnUrl}?session=${providerSessionId}`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    }
  }

  async parseWebhook(rawBody: string): Promise<PaymentWebhookEvent> {
    const parsed = JSON.parse(rawBody) as Record<string, string>

    return {
      provider: "mobile_money",
      providerSessionId: parsed.providerSessionId ?? "",
      providerReference: parsed.providerReference,
      status:
        parsed.status === "confirmed" ||
        parsed.status === "failed" ||
        parsed.status === "cancelled"
          ? parsed.status
          : "pending",
      amount: parsed.amount ? Number(parsed.amount) : undefined,
      currency: parsed.currency,
      metadata: {},
    }
  }
}
