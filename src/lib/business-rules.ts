import type { Debt, DebtStatus, PaymentType } from "@/types"

export function buildDebtStatus(
  remainingAmount: number,
  totalPaid: number
): DebtStatus {
  if (remainingAmount <= 0) {
    return "paid"
  }

  if (totalPaid > 0) {
    return "partial"
  }

  return "unpaid"
}

export function resolveInitialPaid(
  totalAmount: number,
  paymentType: PaymentType,
  initialPaid: number
) {
  const normalizedPaid = paymentType === "cash" ? totalAmount : Number(initialPaid || 0)

  if (normalizedPaid < 0) {
    throw new Error("Le montant paye ne peut pas etre negatif.")
  }

  if (normalizedPaid > totalAmount) {
    throw new Error("Le paiement initial ne peut pas depasser le total.")
  }

  return normalizedPaid
}

export function computeRemainingAmount(totalAmount: number, totalPaid: number) {
  return Math.max(0, totalAmount - totalPaid)
}

export function applyPaymentToDebt(
  debt: Pick<Debt, "initialAmount" | "totalPaid" | "remainingAmount">,
  amount: number
) {
  if (amount <= 0) {
    throw new Error("Le montant du paiement doit etre superieur a zero.")
  }

  if (amount > debt.remainingAmount) {
    throw new Error("Le paiement depasse le montant restant.")
  }

  const totalPaid = debt.totalPaid + amount
  const remainingAmount = computeRemainingAmount(debt.initialAmount, totalPaid)

  return {
    totalPaid,
    remainingAmount,
    status: buildDebtStatus(remainingAmount, totalPaid),
  }
}
