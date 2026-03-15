export type UserRole =
  | "super_admin"
  | "owner"
  | "manager"
  | "seller"
  | "admin"
  | "vendeur"
  | "gestionnaire"
  | "client"

export type PaymentType = "cash" | "credit" | "deposit"
export type DebtStatus = "unpaid" | "partial" | "paid"
export type ProductStatus = "active" | "inactive"
export type PaymentMethod = "cash" | "mobile_money" | "bank" | "card"
export type BusinessPlanCode = "free" | "starter" | "pro" | "enterprise"
export type BusinessStatus = "active" | "suspended" | "trialing" | "archived"
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "expired"
  | "suspended"
  | "cancelled"

export interface User {
  id: string
  fullName: string
  email: string
  password?: string
  role: UserRole
  businessId?: string
  status?: string
  clientId?: string
  isActive: boolean
  createdAt: string
  authProvider?: "password" | "google"
}

export interface Client {
  id: string
  businessId?: string
  fullName: string
  email?: string
  phone: string
  address: string
  notes: string
  createdAt: string
}

export interface Product {
  id: string
  businessId?: string
  name: string
  description: string
  unitPrice: number
  stockQuantity: number
  status: ProductStatus
  createdAt: string
}

export interface SaleItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface Sale {
  id: string
  businessId?: string
  clientId: string
  clientName: string
  saleDate: string
  paymentType: PaymentType
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  notes: string
  createdBy: string
  items: SaleItem[]
  debtId?: string
  createdAt: string
}

export interface Debt {
  id: string
  businessId?: string
  saleId: string
  clientId: string
  clientName: string
  initialAmount: number
  totalPaid: number
  remainingAmount: number
  status: DebtStatus
  dueDate: string
  createdAt: string
}

export interface Payment {
  id: string
  businessId?: string
  debtId: string
  clientId: string
  clientName: string
  paymentDate: string
  amount: number
  method: PaymentMethod
  reference: string
  note: string
  createdBy: string
  createdAt: string
}

export interface StockMovement {
  id: string
  productId: string
  productName: string
  movementType: "in" | "out"
  quantity: number
  reason: string
  referenceId: string
  createdAt: string
}

export interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string
  actorName: string
  details: string
  createdAt: string
}

export interface Business {
  id: string
  name: string
  ownerUid: string
  plan: BusinessPlanCode
  status: BusinessStatus
  createdAt: string
}

export interface Plan {
  id: BusinessPlanCode
  name: string
  monthlyPrice: number
  currency: string
  features: string[]
  active: boolean
  createdAt: string
}

export interface Subscription {
  id: string
  businessId: string
  planId: BusinessPlanCode
  status: SubscriptionStatus
  startedAt: string
  expiresAt?: string
  renewedAt?: string
  suspendedAt?: string
  createdAt: string
}

export interface SubscriptionPayment {
  id: string
  businessId: string
  subscriptionId: string
  amount: number
  currency: string
  provider: string
  providerReference: string
  status: "pending" | "confirmed" | "failed" | "cancelled"
  createdAt: string
}

export interface SaleDraftItem {
  productId: string
  quantity: number
}

export interface SaleInput {
  clientId: string
  saleDate: string
  paymentType: PaymentType
  initialPaid: number
  notes: string
  items: SaleDraftItem[]
}

export interface PaymentInput {
  debtId: string
  paymentDate: string
  amount: number
  method: PaymentMethod
  reference: string
  note: string
}

export type ExternalPaymentProvider =
  | "mobile_money_gateway"
  | "card_gateway"
  | "bank_gateway"

export type PaymentIntentStatus =
  | "pending"
  | "processing"
  | "confirmed"
  | "failed"
  | "cancelled"

export interface ClientPaymentIntent {
  id: string
  clientId: string
  debtId: string
  amount: number
  currency: string
  provider: ExternalPaymentProvider
  status: PaymentIntentStatus
  providerReference: string
  createdAt: string
  confirmedAt?: string
}

export interface AppDataSnapshot {
  users: User[]
  clients: Client[]
  products: Product[]
  sales: Sale[]
  debts: Debt[]
  payments: Payment[]
  stockMovements: StockMovement[]
  auditLogs: AuditLog[]
  businesses: Business[]
  plans: Plan[]
  subscriptions: Subscription[]
  subscriptionPayments: SubscriptionPayment[]
}
