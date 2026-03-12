export type UserRole = "admin" | "vendeur" | "gestionnaire" | "client"

export type PaymentType = "cash" | "credit" | "deposit"
export type DebtStatus = "unpaid" | "partial" | "paid"
export type ProductStatus = "active" | "inactive"
export type PaymentMethod = "cash" | "mobile_money" | "bank" | "card"

export interface User {
  id: string
  fullName: string
  email: string
  password?: string
  role: UserRole
  clientId?: string
  isActive: boolean
  createdAt: string
  authProvider?: "password" | "google"
}

export interface Client {
  id: string
  fullName: string
  email?: string
  phone: string
  address: string
  notes: string
  createdAt: string
}

export interface Product {
  id: string
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
}
