export type ExternalPaymentProvider = "mobile_money" | "card" | "bank_transfer"
export type PaymentKind = "customer_payment" | "subscription_payment"

export interface CreatePaymentSessionInput {
  businessId: string
  amount: number
  currency: string
  provider: ExternalPaymentProvider
  kind: PaymentKind
  debtId?: string
  clientId?: string
  subscriptionId?: string
  customerEmail?: string
  returnUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

export interface PaymentSessionResult {
  providerSessionId: string
  checkoutUrl: string
  providerReference?: string
  expiresAt?: string
}

export interface PaymentWebhookEvent {
  provider: ExternalPaymentProvider
  providerSessionId: string
  providerReference?: string
  status: "pending" | "confirmed" | "failed" | "cancelled"
  amount?: number
  currency?: string
  metadata?: Record<string, string>
}

export interface PaymentProvider {
  createSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult>
  parseWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<PaymentWebhookEvent>
}
