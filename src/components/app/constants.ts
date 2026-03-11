import {
  Boxes,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react"

import type { DebtStatus, PaymentMethod, PaymentType, UserRole } from "@/types"

export type ScreenId =
  | "dashboard"
  | "clients"
  | "products"
  | "sales"
  | "debts"
  | "payments"
  | "reports"

export interface NavItem {
  id: ScreenId
  label: string
  icon: typeof LayoutDashboard
  roles: UserRole[]
}

export const navigation: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "vendeur", "gestionnaire"],
  },
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    roles: ["admin", "vendeur", "gestionnaire"],
  },
  {
    id: "products",
    label: "Produits",
    icon: Boxes,
    roles: ["admin", "gestionnaire"],
  },
  {
    id: "sales",
    label: "Ventes",
    icon: ShoppingCart,
    roles: ["admin", "vendeur", "gestionnaire"],
  },
  {
    id: "debts",
    label: "Dettes",
    icon: Wallet,
    roles: ["admin", "gestionnaire"],
  },
  {
    id: "payments",
    label: "Paiements",
    icon: CreditCard,
    roles: ["admin", "vendeur", "gestionnaire"],
  },
  {
    id: "reports",
    label: "Rapports",
    icon: FileSpreadsheet,
    roles: ["admin", "gestionnaire"],
  },
]

export const screenTitles: Record<ScreenId, string> = {
  dashboard: "Vue generale",
  clients: "Gestion des clients",
  products: "Gestion des produits",
  sales: "Enregistrement des ventes",
  debts: "Suivi des dettes",
  payments: "Paiements partiels",
  reports: "Rapports et exports",
}

export const debtLabels: Record<DebtStatus, string> = {
  unpaid: "Non payee",
  partial: "Partielle",
  paid: "Soldee",
}

export const paymentTypeLabels: Record<PaymentType, string> = {
  cash: "Comptant",
  credit: "Credit",
  deposit: "Acompte",
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Especes",
  mobile_money: "Mobile money",
  bank: "Banque",
  card: "Carte",
}

export function statusClasses(status: DebtStatus) {
  if (status === "paid") {
    return "bg-emerald-100 text-emerald-800"
  }

  if (status === "partial") {
    return "bg-amber-100 text-amber-800"
  }

  return "bg-rose-100 text-rose-800"
}
