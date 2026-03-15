import { initializeApp } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https"

import { MockPaymentProvider } from "./payment-providers/mock.js"
import type { ExternalPaymentProvider } from "./payment-providers/base.js"
import {
  assertCallerHasBusinessAccess,
  backfillBusinessId,
  createBusinessWithOwner,
} from "./tenant.js"

initializeApp()

const db = getFirestore()
const mockProvider = new MockPaymentProvider()

function asProvider(value: unknown): ExternalPaymentProvider {
  if (value === "card" || value === "bank_transfer") {
    return value
  }

  return "mobile_money"
}

export const bootstrapBusiness = onCall(async (request) => {
  if (!request.auth?.uid || !request.auth.token.email) {
    throw new HttpsError("unauthenticated", "User must be authenticated.")
  }

  const businessName = String(request.data?.businessName ?? "").trim()
  const fullName = String(request.data?.fullName ?? "").trim()

  if (!businessName || !fullName) {
    throw new HttpsError("invalid-argument", "businessName and fullName are required.")
  }

  try {
    return await createBusinessWithOwner({
      uid: request.auth.uid,
      email: String(request.auth.token.email),
      fullName,
      businessName,
    })
  } catch (error) {
    throw new HttpsError("internal", error instanceof Error ? error.message : "Bootstrap failed.")
  }
})

export const createPaymentSession = onCall(async (request) => {
  const businessId = String(request.data?.businessId ?? "")
  const amount = Number(request.data?.amount ?? 0)
  const currency = String(request.data?.currency ?? "USD")

  if (!businessId || amount <= 0) {
    throw new HttpsError("invalid-argument", "businessId and amount are required.")
  }

  await assertCallerHasBusinessAccess(request.auth?.uid, businessId)

  const kind =
    request.data?.kind === "subscription_payment"
      ? "subscription_payment"
      : "customer_payment"

  const provider = asProvider(request.data?.provider)
  const result = await mockProvider.createSession({
    businessId,
    amount,
    currency,
    kind,
    provider,
    debtId: typeof request.data?.debtId === "string" ? request.data.debtId : undefined,
    clientId: typeof request.data?.clientId === "string" ? request.data.clientId : undefined,
    subscriptionId:
      typeof request.data?.subscriptionId === "string"
        ? request.data.subscriptionId
        : undefined,
    customerEmail:
      typeof request.data?.customerEmail === "string"
        ? request.data.customerEmail
        : undefined,
    returnUrl: String(request.data?.returnUrl ?? ""),
    cancelUrl: String(request.data?.cancelUrl ?? ""),
    metadata: {},
  })

  const paymentSessionRef = db.collection("payment_sessions").doc()
  await paymentSessionRef.set({
    businessId,
    clientId: request.data?.clientId ?? null,
    debtId: request.data?.debtId ?? null,
    subscriptionId: request.data?.subscriptionId ?? null,
    amount,
    currency,
    provider,
    kind,
    status: "pending",
    providerSessionId: result.providerSessionId,
    providerReference: result.providerReference ?? null,
    checkoutUrl: result.checkoutUrl,
    createdByUid: request.auth?.uid ?? null,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: result.expiresAt ?? null,
  })

  return {
    paymentSessionId: paymentSessionRef.id,
    ...result,
  }
})

export const confirmPayment = onCall(async (request) => {
  const paymentSessionId = String(request.data?.paymentSessionId ?? "")
  if (!paymentSessionId) {
    throw new HttpsError("invalid-argument", "paymentSessionId is required.")
  }

  const sessionSnapshot = await db.collection("payment_sessions").doc(paymentSessionId).get()
  if (!sessionSnapshot.exists) {
    throw new HttpsError("not-found", "Payment session not found.")
  }

  const session = sessionSnapshot.data() ?? {}
  await assertCallerHasBusinessAccess(
    request.auth?.uid,
    String(session.businessId ?? "")
  )

  return {
    paymentSessionId,
    status: String(session.status ?? "pending"),
    providerReference: session.providerReference ?? null,
  }
})

export const paymentWebhook = onRequest(async (request, response) => {
  try {
    const event = await mockProvider.parseWebhook(
      JSON.stringify(request.body ?? {}),
      Object.fromEntries(
        Object.entries(request.headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value[0] : value,
        ])
      )
    )

    const paymentSessions = await db
      .collection("payment_sessions")
      .where("providerSessionId", "==", event.providerSessionId)
      .limit(1)
      .get()

    const target = paymentSessions.docs[0]
    if (!target) {
      response.status(404).json({ error: "session_not_found" })
      return
    }

    const session = target.data()
    await target.ref.set(
      {
        status: event.status,
        webhookReceivedAt: FieldValue.serverTimestamp(),
        providerReference: event.providerReference ?? session.providerReference ?? null,
      },
      { merge: true }
    )

    if (event.status === "confirmed") {
      if (session.kind === "customer_payment" && session.debtId) {
        const debtRef = db.collection("debts").doc(String(session.debtId))
        const debtSnapshot = await debtRef.get()
        if (debtSnapshot.exists) {
          const debt = debtSnapshot.data() ?? {}
          const paymentAmount = Number(session.amount ?? event.amount ?? 0)
          const totalPaid = Number(debt.totalPaid ?? 0) + paymentAmount
          const initialAmount = Number(debt.initialAmount ?? 0)
          const remainingAmount = Math.max(initialAmount - totalPaid, 0)

          await db.runTransaction(async (transaction) => {
            transaction.set(db.collection("payments").doc(), {
              businessId: session.businessId ?? null,
              debtId: session.debtId,
              clientId: session.clientId ?? null,
              clientName: debt.clientName ?? "",
              paymentDate: new Date().toISOString().slice(0, 10),
              amount: paymentAmount,
              method: session.provider === "card" ? "card" : "mobile_money",
              reference: event.providerReference ?? session.providerSessionId,
              note: "Paiement confirme par webhook fournisseur",
              createdBy: "system",
              createdByName: "system",
              createdByUid: "system",
              createdAt: new Date().toISOString(),
            })

            transaction.update(debtRef, {
              totalPaid,
              remainingAmount,
              status: remainingAmount <= 0 ? "paid" : "partial",
            })
          })
        }
      }

      if (session.kind === "subscription_payment" && session.subscriptionId) {
        await db.collection("subscription_payments").add({
          businessId: session.businessId ?? null,
          subscriptionId: session.subscriptionId,
          amount: Number(session.amount ?? event.amount ?? 0),
          currency: session.currency ?? event.currency ?? "USD",
          provider: session.provider ?? event.provider,
          providerReference: event.providerReference ?? null,
          status: "confirmed",
          createdAt: FieldValue.serverTimestamp(),
        })
      }
    }

    response.status(200).json({ ok: true })
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "webhook_failed",
    })
  }
})

export const migrateLegacyBusinessData = onCall(async (request) => {
  const callerProfile = await assertCallerHasBusinessAccess(
    request.auth?.uid,
    String(request.data?.businessId ?? "")
  )

  const role = String(callerProfile.role ?? "")
  if (!["super_admin", "owner", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Only owners or platform admins can migrate.")
  }

  const businessId = String(request.data?.businessId ?? "")
  if (!businessId) {
    throw new HttpsError("invalid-argument", "businessId is required.")
  }

  await backfillBusinessId({
    sourceBusinessId: businessId,
    collections: [
      "clients",
      "products",
      "sales",
      "sale_items",
      "debts",
      "payments",
      "stock_movements",
      "audit_logs",
    ],
  })

  return { ok: true, businessId }
})
