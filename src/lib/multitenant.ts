export const saasCollections = {
  businesses: "businesses",
  plans: "plans",
  subscriptions: "subscriptions",
  subscriptionPayments: "subscription_payments",
  paymentSessions: "payment_sessions",
} as const

export type LegacyRole = "admin" | "gestionnaire" | "vendeur" | "client"
export type SaasRole =
  | "super_admin"
  | "owner"
  | "manager"
  | "seller"
  | "client"
  | LegacyRole

export type BusinessPlanCode = "free" | "starter" | "pro" | "enterprise"
export type BusinessStatus = "active" | "suspended" | "trialing" | "archived"
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "expired"
  | "suspended"
  | "cancelled"

export interface BusinessTenant {
  id: string
  name: string
  ownerUid: string
  plan: BusinessPlanCode
  status: BusinessStatus
  createdAt: string
}

export interface SaasPlan {
  id: BusinessPlanCode
  name: string
  monthlyPrice: number
  currency: string
  features: string[]
  active: boolean
}

export interface BusinessSubscription {
  id: string
  businessId: string
  planId: BusinessPlanCode
  status: SubscriptionStatus
  startedAt: string
  expiresAt?: string
  renewedAt?: string
}

export interface PaymentSessionRequest {
  businessId: string
  clientId?: string
  debtId?: string
  subscriptionId?: string
  amount: number
  currency: string
  provider: string
  returnUrl: string
  cancelUrl: string
  kind: "customer_payment" | "subscription_payment"
}

export function resolveUserBusinessId<T extends { businessId?: unknown }>(
  user: T | null | undefined
) {
  return typeof user?.businessId === "string" && user.businessId
    ? user.businessId
    : null
}

export function withBusinessScope<T extends { businessId?: string | null }>(
  payload: T,
  businessId: string | null
) {
  if (!businessId) {
    return payload
  }

  return {
    ...payload,
    businessId,
  }
}

export function isLegacyDocument(data: { businessId?: unknown } | null | undefined) {
  return !data || typeof data.businessId !== "string" || data.businessId.length === 0
}
