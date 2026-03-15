import { FieldValue, getFirestore } from "firebase-admin/firestore"

const db = getFirestore()

export type SupportedRole =
  | "super_admin"
  | "owner"
  | "manager"
  | "seller"
  | "client"
  | "admin"
  | "gestionnaire"
  | "vendeur"

export async function assertCallerHasBusinessAccess(
  uid: string | undefined,
  businessId: string
) {
  if (!uid) {
    throw new Error("AUTH_REQUIRED")
  }

  const profileSnapshot = await db.collection("users").doc(uid).get()
  if (!profileSnapshot.exists) {
    throw new Error("USER_PROFILE_NOT_FOUND")
  }

  const profile = profileSnapshot.data() ?? {}
  const role = String(profile.role ?? "")
  const callerBusinessId = String(profile.businessId ?? "")

  if (role === "super_admin") {
    return profile
  }

  if (!callerBusinessId || callerBusinessId !== businessId) {
    throw new Error("BUSINESS_ACCESS_DENIED")
  }

  return profile
}

export async function createBusinessWithOwner(input: {
  uid: string
  email: string
  fullName: string
  businessName: string
}) {
  const businessRef = db.collection("businesses").doc()
  const subscriptionRef = db.collection("subscriptions").doc()

  await db.runTransaction(async (transaction) => {
    transaction.set(businessRef, {
      name: input.businessName,
      ownerUid: input.uid,
      plan: "free",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    })

    transaction.set(db.collection("users").doc(input.uid), {
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      role: "owner",
      businessId: businessRef.id,
      status: "active",
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    transaction.set(subscriptionRef, {
      businessId: businessRef.id,
      planId: "free",
      status: "active",
      startedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  return {
    businessId: businessRef.id,
    subscriptionId: subscriptionRef.id,
  }
}

export async function backfillBusinessId(input: {
  sourceBusinessId: string
  collections: string[]
}) {
  for (const collectionName of input.collections) {
    const snapshot = await db
      .collection(collectionName)
      .where("businessId", "==", null)
      .get()
      .catch(async () => db.collection(collectionName).get())

    const batch = db.batch()

    snapshot.docs.forEach((entry) => {
      const data = entry.data()
      if (!data.businessId) {
        batch.set(
          entry.ref,
          {
            businessId: input.sourceBusinessId,
            migratedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
      }
    })

    if (!snapshot.empty) {
      await batch.commit()
    }
  }
}
