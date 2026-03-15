import { useEffect, useState } from "react"
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type AuthError,
  type User as FirebaseUser,
} from "firebase/auth"
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore"

import {
  applyPaymentToDebt,
  buildDebtStatus,
  computeRemainingAmount,
  resolveInitialPaid,
} from "@/lib/business-rules"
import { demoData } from "@/lib/demo-data"
import { auth, db, googleProvider } from "@/lib/firebase"
import { todayIsoDate } from "@/lib/format"
import { resolveUserBusinessId } from "@/lib/multitenant"
import {
  canManageUsers,
  canReadUsersCollection,
  getAssignableRolesForActor,
  isClientRole,
  isProtectedAdminRole,
  normalizeRole,
} from "@/lib/roles"
import type {
  AppDataSnapshot,
  Business,
  Client,
  Debt,
  Payment,
  PaymentInput,
  Plan,
  Product,
  Sale,
  SaleInput,
  SaleItem,
  StockMovement,
  Subscription,
  SubscriptionPayment,
  User,
  UserRole,
} from "@/types"

const useFirebaseAuth = import.meta.env.VITE_ENABLE_FIREBASE_AUTH === "true"
const localUsersStorageKey = "marcher-vente-local-users"

const firestoreCollections = {
  clients: "clients",
  products: "products",
  sales: "sales",
  debts: "debts",
  payments: "payments",
  stockMovements: "stock_movements",
  auditLogs: "audit_logs",
  saleItems: "sale_items",
  users: "users",
  businesses: "businesses",
  plans: "plans",
  subscriptions: "subscriptions",
  subscriptionPayments: "subscription_payments",
} as const

function cloneSnapshot(snapshot: AppDataSnapshot): AppDataSnapshot {
  return structuredClone(snapshot)
}

function uuid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function fallbackUserFromDemo(email: string | null | undefined) {
  if (!email) {
    return null
  }

  return demoData.users.find(
    (entry) => entry.email.toLowerCase() === email.toLowerCase()
  ) ?? null
}

function readLocalUsers() {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = window.localStorage.getItem(localUsersStorageKey)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalUsers(users: User[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(localUsersStorageKey, JSON.stringify(users))
}

function buildInitialSnapshot() {
  const snapshot = cloneSnapshot(
    useFirebaseAuth
      ? {
          ...demoData,
          users: [],
          clients: [],
          products: [],
          sales: [],
          debts: [],
          payments: [],
          stockMovements: [],
          auditLogs: [],
          businesses: [],
          plans: [],
          subscriptions: [],
          subscriptionPayments: [],
        }
      : demoData
  )

  if (useFirebaseAuth) {
    return snapshot
  }

  const localUsers = readLocalUsers()

  const mergedUsers = [...localUsers, ...snapshot.users.filter((demoUser) =>
    !localUsers.some(
      (localUser) =>
        typeof localUser?.email === "string" &&
        localUser.email.toLowerCase() === demoUser.email.toLowerCase()
    )
  )]

  return {
    ...snapshot,
    users: mergedUsers,
  }
}

function asIsoString(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString()
  }

  if (typeof value === "string") {
    return value
  }

  return new Date().toISOString()
}

function mapClientDoc(id: string, data: DocumentData): Client {
  return {
    id,
    businessId:
      typeof data.businessId === "string" && data.businessId ? data.businessId : undefined,
    fullName: String(data.fullName ?? ""),
    email: typeof data.email === "string" ? data.email : undefined,
    phone: String(data.phone ?? ""),
    address: String(data.address ?? ""),
    notes: String(data.notes ?? ""),
    createdAt: asIsoString(data.createdAt),
  }
}

function mapProductDoc(id: string, data: DocumentData): Product {
  return {
    id,
    businessId:
      typeof data.businessId === "string" && data.businessId ? data.businessId : undefined,
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    unitPrice: Number(data.unitPrice ?? 0),
    stockQuantity: Number(data.stockQuantity ?? 0),
    status: data.status === "inactive" ? "inactive" : "active",
    createdAt: asIsoString(data.createdAt),
  }
}

function mapSaleDoc(id: string, data: DocumentData): Sale {
  return {
    id,
    businessId:
      typeof data.businessId === "string" && data.businessId ? data.businessId : undefined,
    clientId: String(data.clientId ?? ""),
    clientName: String(data.clientName ?? ""),
    saleDate: String(data.saleDate ?? todayIsoDate()),
    paymentType:
      data.paymentType === "credit" || data.paymentType === "deposit"
        ? data.paymentType
        : "cash",
    totalAmount: Number(data.totalAmount ?? 0),
    paidAmount: Number(data.paidAmount ?? 0),
    remainingAmount: Number(data.remainingAmount ?? 0),
    notes: String(data.notes ?? ""),
    createdBy: String(data.createdByName ?? data.createdBy ?? ""),
    items: Array.isArray(data.items)
      ? data.items.map((item: DocumentData) => ({
          id: String(item.id ?? crypto.randomUUID()),
          productId: String(item.productId ?? ""),
          productName: String(item.productName ?? ""),
          quantity: Number(item.quantity ?? 0),
          unitPrice: Number(item.unitPrice ?? 0),
          lineTotal: Number(item.lineTotal ?? 0),
        }))
      : [],
    debtId: typeof data.debtId === "string" && data.debtId ? data.debtId : undefined,
    createdAt: asIsoString(data.createdAt),
  }
}

function mapDebtDoc(id: string, data: DocumentData): Debt {
  return {
    id,
    businessId:
      typeof data.businessId === "string" && data.businessId ? data.businessId : undefined,
    saleId: String(data.saleId ?? ""),
    clientId: String(data.clientId ?? ""),
    clientName: String(data.clientName ?? ""),
    initialAmount: Number(data.initialAmount ?? 0),
    totalPaid: Number(data.totalPaid ?? 0),
    remainingAmount: Number(data.remainingAmount ?? 0),
    status:
      data.status === "partial" || data.status === "paid" ? data.status : "unpaid",
    dueDate: String(data.dueDate ?? todayIsoDate()),
    createdAt: asIsoString(data.createdAt),
  }
}

function mapPaymentDoc(id: string, data: DocumentData): Payment {
  return {
    id,
    businessId:
      typeof data.businessId === "string" && data.businessId ? data.businessId : undefined,
    debtId: String(data.debtId ?? ""),
    clientId: String(data.clientId ?? ""),
    clientName: String(data.clientName ?? ""),
    paymentDate: String(data.paymentDate ?? todayIsoDate()),
    amount: Number(data.amount ?? 0),
    method:
      data.method === "mobile_money" || data.method === "bank" || data.method === "card"
        ? data.method
        : "cash",
    reference: String(data.reference ?? ""),
    note: String(data.note ?? ""),
    createdBy: String(data.createdByName ?? data.createdBy ?? ""),
    createdAt: asIsoString(data.createdAt),
  }
}

function mapStockMovementDoc(id: string, data: DocumentData): StockMovement {
  return {
    id,
    productId: String(data.productId ?? ""),
    productName: String(data.productName ?? ""),
    movementType: data.movementType === "in" ? "in" : "out",
    quantity: Number(data.quantity ?? 0),
    reason: String(data.reason ?? ""),
    referenceId: String(data.referenceId ?? ""),
    createdAt: asIsoString(data.createdAt),
  }
}

function mapAuditLogDoc(id: string, data: DocumentData) {
  return {
    id,
    action: String(data.action ?? ""),
    entityType: String(data.entityType ?? ""),
    entityId: String(data.entityId ?? ""),
    actorName: String(data.actorName ?? ""),
    details: String(data.details ?? ""),
    createdAt: asIsoString(data.createdAt),
  }
}

function mapUserDoc(id: string, data: DocumentData): User {
  return {
    id,
    fullName: String(data.fullName ?? ""),
    email: String(data.email ?? ""),
    role: normalizeRole(data.role),
    businessId:
      typeof data.businessId === "string" && data.businessId ? data.businessId : undefined,
    status: typeof data.status === "string" && data.status ? data.status : undefined,
    clientId: typeof data.clientId === "string" && data.clientId ? data.clientId : undefined,
    isActive: data.isActive !== false,
    authProvider: data.authProvider === "google" ? "google" : "password",
    createdAt: asIsoString(data.createdAt),
  }
}

function mapBusinessDoc(id: string, data: DocumentData): Business {
  return {
    id,
    name: String(data.name ?? ""),
    ownerUid: String(data.ownerUid ?? ""),
    plan:
      data.plan === "starter" ||
      data.plan === "pro" ||
      data.plan === "enterprise"
        ? data.plan
        : "free",
    status:
      data.status === "suspended" ||
      data.status === "trialing" ||
      data.status === "archived"
        ? data.status
        : "active",
    createdAt: asIsoString(data.createdAt),
  }
}

function mapPlanDoc(id: string, data: DocumentData): Plan {
  return {
    id:
      id === "starter" || id === "pro" || id === "enterprise"
        ? id
        : "free",
    name: String(data.name ?? ""),
    monthlyPrice: Number(data.monthlyPrice ?? 0),
    currency: String(data.currency ?? "USD"),
    features: Array.isArray(data.features)
      ? data.features.map((entry) => String(entry))
      : [],
    active: data.active !== false,
    createdAt: asIsoString(data.createdAt),
  }
}

function mapSubscriptionDoc(id: string, data: DocumentData): Subscription {
  return {
    id,
    businessId: String(data.businessId ?? ""),
    planId:
      data.planId === "starter" || data.planId === "pro" || data.planId === "enterprise"
        ? data.planId
        : "free",
    status:
      data.status === "trialing" ||
      data.status === "past_due" ||
      data.status === "expired" ||
      data.status === "suspended" ||
      data.status === "cancelled"
        ? data.status
        : "active",
    startedAt: asIsoString(data.startedAt ?? data.createdAt),
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : undefined,
    renewedAt: typeof data.renewedAt === "string" ? data.renewedAt : undefined,
    suspendedAt: typeof data.suspendedAt === "string" ? data.suspendedAt : undefined,
    createdAt: asIsoString(data.createdAt),
  }
}

function mapSubscriptionPaymentDoc(id: string, data: DocumentData): SubscriptionPayment {
  return {
    id,
    businessId: String(data.businessId ?? ""),
    subscriptionId: String(data.subscriptionId ?? ""),
    amount: Number(data.amount ?? 0),
    currency: String(data.currency ?? "USD"),
    provider: String(data.provider ?? ""),
    providerReference: String(data.providerReference ?? ""),
    status:
      data.status === "pending" ||
      data.status === "failed" ||
      data.status === "cancelled"
        ? data.status
        : "confirmed",
    createdAt: asIsoString(data.createdAt),
  }
}

function formatAuthError(error: unknown) {
  const code = (error as AuthError | undefined)?.code

  switch (code) {
    case "auth/operation-not-allowed":
      return "Active Email/Mot de passe dans Firebase Authentication."
    case "auth/email-already-in-use":
      return "Cette adresse email est deja utilisee."
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email ou mot de passe invalide."
    case "auth/popup-closed-by-user":
      return "La fenetre Google a ete fermee avant la fin."
    case "auth/too-many-requests":
      return "Trop de tentatives. Reessaie plus tard."
    case "auth/network-request-failed":
      return "Connexion reseau impossible vers Firebase."
    default:
      return error instanceof Error ? error.message : "Erreur d'authentification."
  }
}

function formatUsersCollectionIssue(currentUser: User | null, error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : ""

  if (code === "permission-denied" || code === "firestore/permission-denied") {
    if (!currentUser) {
      return "Lecture de users refusee: aucune session utilisateur n'est active."
    }

    if (!canReadUsersCollection(currentUser.role)) {
      return `Permission denied sur users: le role ${currentUser.role} ne peut pas lire toute la collection users.`
    }

    return `Permission denied sur users alors que le role courant est ${currentUser.role}. Cause probable: regles Firestore non deployees ou document users/${currentUser.id} incoherent.`
  }

  if (error instanceof Error) {
    return `Lecture de users impossible: ${error.message}`
  }

  return "Lecture de users impossible."
}

function buildUserProfile(
  firebaseUser: FirebaseUser,
  role: UserRole,
  fallbackFullName?: string,
  clientId?: string,
  businessId?: string
): User {
  return {
    id: firebaseUser.uid,
    fullName:
      firebaseUser.displayName ??
      fallbackFullName ??
      firebaseUser.email?.split("@")[0] ??
      "Utilisateur",
    email: firebaseUser.email ?? "",
    role,
    businessId,
    clientId,
    status: "active",
    isActive: true,
    authProvider:
      firebaseUser.providerData[0]?.providerId === "google.com" ? "google" : "password",
    createdAt: new Date().toISOString(),
  }
}

function belongsToBusiness(
  data: { businessId?: string },
  businessId: string | null
) {
  if (!businessId) {
    return true
  }

  return !data.businessId || data.businessId === businessId
}

function belongsToBusinessStrict(
  data: { businessId?: string },
  businessId: string | null
) {
  if (!businessId) {
    return true
  }

  return data.businessId === businessId
}

async function persistUserProfile(profile: User) {
  await setDoc(
    doc(db, "users", profile.id),
    {
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      businessId: profile.businessId ?? null,
      status: profile.status ?? "active",
      clientId: profile.clientId ?? null,
      isActive: profile.isActive,
      authProvider: profile.authProvider ?? "password",
      createdAt: profile.createdAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

async function syncUserProfile(firebaseUser: FirebaseUser): Promise<User> {
  const fallbackUser = fallbackUserFromDemo(firebaseUser.email)
  const fallbackRole: UserRole = fallbackUser?.role ?? "vendeur"
  const fallbackProfile = buildUserProfile(
    firebaseUser,
    fallbackRole,
    fallbackUser?.fullName,
    fallbackUser?.clientId,
    fallbackUser?.businessId
  )

  async function resolveClientProfile() {
    const email = firebaseUser.email?.trim().toLowerCase()
    if (!email) {
      return null
    }

    const snapshot = await getDocs(
      query(
        collection(db, "clients"),
        where("email", "==", email),
        limit(1)
      )
    )

    const clientDoc = snapshot.docs[0]
    if (!clientDoc) {
      return null
    }

    return buildUserProfile(
      firebaseUser,
      "client",
      clientDoc.data().fullName,
      clientDoc.id
    )
  }

  try {
    const snapshot = await getDoc(doc(db, "users", firebaseUser.uid))

    if (!snapshot.exists()) {
      try {
        const clientProfile = await resolveClientProfile()
        const nextProfile = clientProfile ?? fallbackProfile
        await persistUserProfile(nextProfile)
        return nextProfile
      } catch (error) {
        console.warn("Impossible d'enregistrer le profil Firestore.", error)
      }
      return fallbackProfile
    }

    const data = snapshot.data()
    const resolvedClientProfile =
      (typeof data.clientId === "string" && data.clientId ? null : await resolveClientProfile())

    const profile: User = {
      id: firebaseUser.uid,
      fullName:
        typeof data.fullName === "string"
          ? data.fullName
          : fallbackProfile.fullName,
      email:
        typeof data.email === "string" && data.email
          ? data.email
          : fallbackProfile.email,
      role: normalizeRole(data.role ?? resolvedClientProfile?.role ?? fallbackRole),
      businessId:
        typeof data.businessId === "string" && data.businessId
          ? data.businessId
          : fallbackProfile.businessId,
      clientId:
        typeof data.clientId === "string" && data.clientId
          ? data.clientId
          : resolvedClientProfile?.clientId ?? fallbackProfile.clientId,
      status:
        typeof data.status === "string" && data.status
          ? data.status
          : fallbackProfile.status,
      isActive: data.isActive !== false,
      authProvider: data.authProvider === "google" ? "google" : "password",
      createdAt:
        typeof data.createdAt === "string" ? data.createdAt : fallbackProfile.createdAt,
    }

    try {
      await persistUserProfile(profile)
    } catch (error) {
      console.warn("Impossible de synchroniser le profil Firestore.", error)
    }

    return profile
  } catch (error) {
    console.warn("Lecture du profil Firestore impossible, profil local utilise.", error)
    return fallbackProfile
  }
}

export function useCommercialApp() {
  const [data, setData] = useState<AppDataSnapshot>(() => buildInitialSnapshot())
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!useFirebaseAuth)
  const [manageableUsers, setManageableUsers] = useState<User[]>([])
  const [usersCollectionIssue, setUsersCollectionIssue] = useState<string | null>(null)

  function getCurrentBusinessId() {
    const directBusinessId = resolveUserBusinessId(currentUser)
    if (directBusinessId) {
      return directBusinessId
    }

    if (currentUser) {
      const loadedUserBusinessId = resolveUserBusinessId(
        data.users.find((entry) => entry.id === currentUser.id)
      )
      if (loadedUserBusinessId) {
        return loadedUserBusinessId
      }

      const ownedBusiness = data.businesses.find((entry) => entry.ownerUid === currentUser.id)
      if (ownedBusiness?.id) {
        return ownedBusiness.id
      }
    }

    return null
  }

  useEffect(() => {
    if (useFirebaseAuth) {
      return
    }

    const localUsers = data.users.filter(
      (user) => !demoData.users.some((demoUser) => demoUser.email === user.email)
    )
    writeLocalUsers(localUsers)
  }, [data.users])

  useEffect(() => {
    if (!useFirebaseAuth) {
      setAuthReady(true)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentUser(null)
        setAuthReady(true)
        return
      }

      try {
        const profile = await syncUserProfile(firebaseUser)
        if (!profile.isActive) {
          await signOut(auth)
          throw new Error("Ce compte est desactive.")
        }
        setCurrentUser(profile)
      } catch (error) {
        setCurrentUser(null)
        console.error(error)
      } finally {
        setAuthReady(true)
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!useFirebaseAuth || !currentUser) {
      return
    }

    const unsubscribers: Array<() => void> = []

    if (isClientRole(currentUser.role)) {
      unsubscribers.push(
        onSnapshot(collection(db, firestoreCollections.businesses), (snapshot) => {
          setData((current) => ({
            ...current,
            businesses: snapshot.docs
              .map((entry) => mapBusinessDoc(entry.id, entry.data()))
              .sort((left, right) => left.name.localeCompare(right.name)),
          }))
        })
      )

      if (currentUser.clientId) {
        unsubscribers.push(
          onSnapshot(doc(db, firestoreCollections.clients, currentUser.clientId), (snapshot) => {
            setData((current) => ({
              ...current,
              clients: snapshot.exists() ? [mapClientDoc(snapshot.id, snapshot.data())] : [],
            }))
          })
        )
        unsubscribers.push(
          onSnapshot(
            query(
              collection(db, firestoreCollections.debts),
              where("clientId", "==", currentUser.clientId)
            ),
            (snapshot) => {
              setData((current) => ({
                ...current,
                debts: snapshot.docs
                  .map((entry) => mapDebtDoc(entry.id, entry.data()))
                  .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
              }))
            }
          )
        )
        unsubscribers.push(
          onSnapshot(
            query(
              collection(db, firestoreCollections.payments),
              where("clientId", "==", currentUser.clientId)
            ),
            (snapshot) => {
              setData((current) => ({
                ...current,
                payments: snapshot.docs
                  .map((entry) => mapPaymentDoc(entry.id, entry.data()))
                  .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)),
              }))
            }
          )
        )
      } else {
        setData((current) => ({
          ...current,
          clients: [],
          products: [],
          sales: [],
          debts: [],
          payments: [],
          stockMovements: [],
          auditLogs: [],
        }))
      }

      unsubscribers.push(
        onSnapshot(doc(db, firestoreCollections.users, currentUser.id), (snapshot) => {
          setUsersCollectionIssue(null)
          setData((current) => ({
            ...current,
            users: snapshot.exists() ? [mapUserDoc(snapshot.id, snapshot.data())] : [],
          }))
        }, (error) => {
          setUsersCollectionIssue(formatUsersCollectionIssue(currentUser, error))
          setData((current) => ({ ...current, users: [] }))
        })
      )
    } else {
      const businessId = getCurrentBusinessId()
      const canAccessBusinessData = currentUser.role === "super_admin" || !!businessId

      if (!canAccessBusinessData) {
        unsubscribers.push(
          onSnapshot(doc(db, firestoreCollections.users, currentUser.id), (snapshot) => {
            setUsersCollectionIssue(null)
            setData((current) => ({
              ...current,
              users: snapshot.exists() ? [mapUserDoc(snapshot.id, snapshot.data())] : [],
              clients: [],
              products: [],
              sales: [],
              debts: [],
              payments: [],
              stockMovements: [],
              auditLogs: [],
              businesses: [],
              plans: [],
              subscriptions: [],
              subscriptionPayments: [],
            }))
          })
        )

        return () => {
          unsubscribers.forEach((unsubscribe) => unsubscribe())
        }
      }

      unsubscribers.push(
        onSnapshot(collection(db, firestoreCollections.clients), (snapshot) => {
          const businessId = getCurrentBusinessId()
          setData((current) => ({
            ...current,
            clients: snapshot.docs
              .map((entry) => mapClientDoc(entry.id, entry.data()))
              .filter((entry) =>
                currentUser.role === "super_admin"
                  ? true
                  : belongsToBusinessStrict(entry, businessId)
              ),
          }))
        })
      )

      if (canReadUsersCollection(currentUser.role) || currentUser.role === "seller" || currentUser.role === "vendeur") {
        unsubscribers.push(
          onSnapshot(collection(db, firestoreCollections.users), (snapshot) => {
            const businessId = getCurrentBusinessId()
            setUsersCollectionIssue(null)
            setData((current) => ({
              ...current,
              users: snapshot.docs
                .map((entry) => mapUserDoc(entry.id, entry.data()))
                .filter((entry) =>
                  currentUser.role === "super_admin"
                    ? true
                    : entry.role !== "super_admin" && belongsToBusiness(entry, businessId)
                )
                .sort((left, right) => left.fullName.localeCompare(right.fullName)),
            }))
          }, (error) => {
            setUsersCollectionIssue(formatUsersCollectionIssue(currentUser, error))
            setData((current) => ({ ...current, users: [] }))
          })
        )
      } else {
        unsubscribers.push(
          onSnapshot(doc(db, firestoreCollections.users, currentUser.id), (snapshot) => {
            setUsersCollectionIssue(null)
            setData((current) => ({
              ...current,
              users: snapshot.exists() ? [mapUserDoc(snapshot.id, snapshot.data())] : [],
            }))
          }, (error) => {
            setUsersCollectionIssue(formatUsersCollectionIssue(currentUser, error))
            setData((current) => ({ ...current, users: [] }))
          })
        )
      }

      unsubscribers.push(
        onSnapshot(collection(db, firestoreCollections.products), (snapshot) => {
          const businessId = getCurrentBusinessId()
          setData((current) => ({
            ...current,
            products: snapshot.docs
              .map((entry) => mapProductDoc(entry.id, entry.data()))
              .filter((entry) =>
                currentUser.role === "super_admin"
                  ? true
                  : belongsToBusinessStrict(entry, businessId)
              ),
          }))
        })
      )
      unsubscribers.push(
        onSnapshot(collection(db, firestoreCollections.sales), (snapshot) => {
          const businessId = getCurrentBusinessId()
          setData((current) => ({
            ...current,
            sales: snapshot.docs
              .map((entry) => mapSaleDoc(entry.id, entry.data()))
              .filter((entry) =>
                currentUser.role === "super_admin"
                  ? true
                  : belongsToBusinessStrict(entry, businessId)
              )
              .sort((left, right) => right.saleDate.localeCompare(left.saleDate)),
          }))
        })
      )
      unsubscribers.push(
        onSnapshot(collection(db, firestoreCollections.debts), (snapshot) => {
          const businessId = getCurrentBusinessId()
          setData((current) => ({
            ...current,
            debts: snapshot.docs
              .map((entry) => mapDebtDoc(entry.id, entry.data()))
              .filter((entry) =>
                currentUser.role === "super_admin"
                  ? true
                  : belongsToBusinessStrict(entry, businessId)
              )
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
          }))
        })
      )
      unsubscribers.push(
        onSnapshot(collection(db, firestoreCollections.payments), (snapshot) => {
          const businessId = getCurrentBusinessId()
          setData((current) => ({
            ...current,
            payments: snapshot.docs
              .map((entry) => mapPaymentDoc(entry.id, entry.data()))
              .filter((entry) =>
                currentUser.role === "super_admin"
                  ? true
                  : belongsToBusinessStrict(entry, businessId)
              )
              .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)),
          }))
        })
      )
      unsubscribers.push(
        onSnapshot(
          collection(db, firestoreCollections.stockMovements),
          (snapshot) => {
            setData((current) => ({
              ...current,
              stockMovements: snapshot.docs
                .map((entry) => mapStockMovementDoc(entry.id, entry.data()))
                .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
            }))
          },
          () => {
            setData((current) => ({ ...current, stockMovements: [] }))
          }
        )
      )
      unsubscribers.push(
        onSnapshot(
          collection(db, firestoreCollections.auditLogs),
          (snapshot) => {
            setData((current) => ({
              ...current,
              auditLogs: snapshot.docs
                .map((entry) => mapAuditLogDoc(entry.id, entry.data()))
                .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
            }))
          },
          () => {
            setData((current) => ({ ...current, auditLogs: [] }))
          }
        )
      )

      if (currentUser.role === "super_admin") {
        unsubscribers.push(
          onSnapshot(collection(db, firestoreCollections.businesses), (snapshot) => {
            setData((current) => ({
              ...current,
              businesses: snapshot.docs
                .map((entry) => mapBusinessDoc(entry.id, entry.data()))
                .sort((left, right) => left.name.localeCompare(right.name)),
            }))
          })
        )
        unsubscribers.push(
          onSnapshot(collection(db, firestoreCollections.plans), (snapshot) => {
            setData((current) => ({
              ...current,
              plans: snapshot.docs.map((entry) => mapPlanDoc(entry.id, entry.data())),
            }))
          })
        )
        unsubscribers.push(
          onSnapshot(collection(db, firestoreCollections.subscriptions), (snapshot) => {
            setData((current) => ({
              ...current,
              subscriptions: snapshot.docs
                .map((entry) => mapSubscriptionDoc(entry.id, entry.data()))
                .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
            }))
          })
        )
        unsubscribers.push(
          onSnapshot(collection(db, firestoreCollections.subscriptionPayments), (snapshot) => {
            setData((current) => ({
              ...current,
              subscriptionPayments: snapshot.docs
                .map((entry) => mapSubscriptionPaymentDoc(entry.id, entry.data()))
                .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
            }))
          })
        )
      } else {
        setData((current) => ({
          ...current,
          businesses: [],
          plans: [],
          subscriptions: [],
          subscriptionPayments: [],
        }))
      }
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      setManageableUsers([])
      setUsersCollectionIssue(null)
      return
    }

    setManageableUsers(data.users)
  }, [currentUser, data.users])

  useEffect(() => {
    if (!useFirebaseAuth || !currentUser || usersCollectionIssue) {
      return
    }

    if (canReadUsersCollection(currentUser.role) && data.users.length === 0) {
      setUsersCollectionIssue(
        "Aucun document utilisateur trouve dans Firestore. Cause probable: documents manquants dans la collection users."
      )
    }
  }, [currentUser, data.users.length, usersCollectionIssue])

  useEffect(() => {
    if (!currentUser) {
      return
    }

    const syncedUser = data.users.find((user) => user.id === currentUser.id)
    if (!syncedUser) {
      return
    }

    if (!syncedUser.isActive && currentUser.isActive) {
      void logout()
      return
    }

    if (
      syncedUser.role !== currentUser.role ||
      syncedUser.clientId !== currentUser.clientId ||
      syncedUser.isActive !== currentUser.isActive ||
      syncedUser.fullName !== currentUser.fullName ||
      syncedUser.email !== currentUser.email
    ) {
      setCurrentUser(syncedUser)
    }
  }, [currentUser, data.users])

  async function login(email: string, password: string) {
    const loginLocally = () => {
      const user = data.users.find(
        (entry) =>
          entry.email.toLowerCase() === email.toLowerCase() &&
          entry.password === password &&
          entry.isActive
      )

      if (!user) {
        throw new Error("Email ou mot de passe invalide.")
      }

      setCurrentUser(user)
      return user
    }

    if (!useFirebaseAuth) {
      return loginLocally()
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const profile = await syncUserProfile(credential.user)
      setCurrentUser(profile)
      return profile
    } catch (error) {
      if ((error as AuthError | undefined)?.code === "auth/network-request-failed") {
        throw new Error(
          "Connexion Firebase impossible. Aucune session securisee n'a ete ouverte."
        )
      }
      throw new Error(formatAuthError(error))
    }
  }

  async function register(
    fullName: string,
    email: string,
    password: string,
    accountType: "client" | "owner" = "client",
    businessName = ""
  ) {
    if (!fullName.trim()) {
      throw new Error("Le nom complet est obligatoire.")
    }

    if (accountType === "owner" && !businessName.trim()) {
      throw new Error("Le nom du business est obligatoire pour un compte commerce.")
    }

    const registerLocally = () => {
      const exists = data.users.some(
        (entry) => entry.email.toLowerCase() === email.toLowerCase()
      )

      if (exists) {
        throw new Error("Cette adresse email est deja utilisee.")
      }

      const businessId = accountType === "owner" ? uuid("biz") : undefined
      const profile: User = {
        id: uuid("usr"),
        fullName: fullName.trim(),
        email,
        password,
        role: accountType === "owner" ? "owner" : "client",
        businessId,
        status: "active",
        clientId: undefined,
        isActive: true,
        authProvider: "password",
        createdAt: new Date().toISOString(),
      }

      setData((current) => ({
        ...current,
        businesses:
          accountType === "owner"
            ? [
                {
                  id: businessId!,
                  name: businessName.trim(),
                  ownerUid: profile.id,
                  plan: "free",
                  status: "active",
                  createdAt: new Date().toISOString(),
                },
                ...current.businesses,
              ]
            : current.businesses,
        users: [profile, ...current.users],
      }))
      setCurrentUser(profile)
      return profile
    }

    if (!useFirebaseAuth) {
      return registerLocally()
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(credential.user, { displayName: fullName })

      const profile = buildUserProfile(
        credential.user,
        accountType === "owner" ? "owner" : "client",
        fullName
      )
      profile.status = "active"

      if (accountType === "owner") {
        const businessRef = doc(collection(db, firestoreCollections.businesses))
        profile.businessId = businessRef.id
        await setDoc(businessRef, {
          name: businessName.trim(),
          ownerUid: credential.user.uid,
          plan: "free",
          status: "active",
          createdAt: new Date().toISOString(),
        })
      }

      try {
        await persistUserProfile(profile)
      } catch (error) {
        console.warn("Creation du profil Firestore impossible apres inscription.", error)
      }

      setCurrentUser(profile)
      return profile
    } catch (error) {
      if ((error as AuthError | undefined)?.code === "auth/network-request-failed") {
        throw new Error(
          "Inscription Firebase impossible. Reessaie quand la connexion au projet Firebase est disponible."
        )
      }
      throw new Error(formatAuthError(error))
    }
  }

  async function loginWithGoogle() {
    if (!useFirebaseAuth) {
      throw new Error(
        "La connexion Google demande Firebase Auth. Active VITE_ENABLE_FIREBASE_AUTH=true."
      )
    }

    try {
      const credential = await signInWithPopup(auth, googleProvider)
      const profile = await syncUserProfile(credential.user)
      setCurrentUser(profile)
      return profile
    } catch (error) {
      throw new Error(formatAuthError(error))
    }
  }

  async function logout() {
    if (useFirebaseAuth) {
      await signOut(auth)
    }
    setCurrentUser(null)
    setManageableUsers([])
  }

  function ensureAdminCanManageUsers() {
    if (!currentUser) {
      throw new Error("Utilisateur non connecte.")
    }

    if (!canManageUsers(currentUser.role)) {
      throw new Error("Seul un compte administrateur peut gerer les roles.")
    }
  }

  function countActiveAdmins(users: User[]) {
    return users.filter((user) => isProtectedAdminRole(user.role) && user.isActive).length
  }

  function getManageableUsersSource() {
    return data.users
  }

  function updateUserRole(userId: string, role: UserRole) {
    ensureAdminCanManageUsers()
    const adminUser = currentUser
    if (!adminUser) {
      throw new Error("Utilisateur non connecte.")
    }

    const usersSource = getManageableUsersSource()
    const targetUser = usersSource.find((user) => user.id === userId) ?? data.users.find((user) => user.id === userId)
    if (!targetUser) {
      throw new Error("Utilisateur introuvable.")
    }

    if (!getAssignableRolesForActor(adminUser.role).includes(role)) {
      throw new Error("Ce role ne peut pas etre attribue par votre compte.")
    }

    const activeAdmins = countActiveAdmins(usersSource)
    if (
      targetUser.id === currentUser?.id &&
      isProtectedAdminRole(targetUser.role) &&
      !isProtectedAdminRole(role) &&
      activeAdmins <= 1
    ) {
      throw new Error("Le dernier compte administrateur actif ne peut pas perdre ses privileges.")
    }

    if (useFirebaseAuth) {
      return updateDoc(doc(db, firestoreCollections.users, userId), {
        role,
        updatedAt: serverTimestamp(),
      }).then(() => {
        if (adminUser.id === userId) {
          setCurrentUser((existing) => (existing ? { ...existing, role } : existing))
        }
      })
    }

    setData((current) => ({
      ...current,
      users: current.users.map((user) => (user.id === userId ? { ...user, role } : user)),
      auditLogs: [
        appendAudit(
          "USER_ROLE_UPDATED",
          "user",
          userId,
          `Role de ${targetUser.fullName} passe a ${role}.`,
          adminUser.fullName
        ),
        ...current.auditLogs,
      ],
    }))

    if (adminUser.id === userId) {
      setCurrentUser((existing) => (existing ? { ...existing, role } : existing))
    }
  }

  function toggleUserActive(userId: string, isActive: boolean) {
    ensureAdminCanManageUsers()
    const adminUser = currentUser
    if (!adminUser) {
      throw new Error("Utilisateur non connecte.")
    }

    const usersSource = getManageableUsersSource()
    const targetUser = usersSource.find((user) => user.id === userId) ?? data.users.find((user) => user.id === userId)
    if (!targetUser) {
      throw new Error("Utilisateur introuvable.")
    }

    const activeAdmins = countActiveAdmins(usersSource)
    if (
      isProtectedAdminRole(targetUser.role) &&
      targetUser.isActive &&
      !isActive &&
      activeAdmins <= 1
    ) {
      throw new Error("Le dernier compte administrateur actif ne peut pas etre desactive.")
    }

    if (useFirebaseAuth) {
      return updateDoc(doc(db, firestoreCollections.users, userId), {
        isActive,
        updatedAt: serverTimestamp(),
      }).then(async () => {
        if (adminUser.id === userId && !isActive) {
          await logout()
        }
      })
    }

    setData((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === userId ? { ...user, isActive } : user
      ),
      auditLogs: [
        appendAudit(
          "USER_STATUS_UPDATED",
          "user",
          userId,
          `${targetUser.fullName} ${isActive ? "active" : "desactive"}.`,
          adminUser.fullName
        ),
        ...current.auditLogs,
      ],
    }))

    if (adminUser.id === userId && !isActive) {
      void logout()
    }
  }

  function appendAudit(
    action: string,
    entityType: string,
    entityId: string,
    details: string,
    actorName: string
  ) {
    return {
      id: uuid("log"),
      action,
      entityType,
      entityId,
      actorName,
      details,
      createdAt: new Date().toISOString(),
    }
  }

  async function syncClientUserLink(clientId: string, email?: string) {
    const normalizedEmail = email?.trim().toLowerCase() ?? ""
    const businessId = getCurrentBusinessId()

    if (useFirebaseAuth) {
      const linkedUsersSnapshot = await getDocs(
        query(collection(db, firestoreCollections.users), where("clientId", "==", clientId))
      )

      const targetUsersSnapshot = normalizedEmail
        ? await getDocs(
            query(collection(db, firestoreCollections.users), where("email", "==", normalizedEmail))
          )
        : null

      const targetUserIds = new Set(
        (targetUsersSnapshot?.docs ?? []).map((entry) => entry.id)
      )

      await Promise.all(
        linkedUsersSnapshot.docs
          .filter((entry) => !targetUserIds.has(entry.id))
          .map((entry) =>
            updateDoc(doc(db, firestoreCollections.users, entry.id), {
              clientId: null,
              updatedAt: serverTimestamp(),
            })
          )
      )

      if (!targetUsersSnapshot) {
        return
      }

      await Promise.all(
        targetUsersSnapshot.docs.map((entry) =>
          updateDoc(doc(db, firestoreCollections.users, entry.id), {
            role: "client",
            businessId: businessId ?? null,
            clientId,
            updatedAt: serverTimestamp(),
          })
        )
      )
      return
    }

    setData((current) => ({
      ...current,
      users: current.users.map((user) => {
        const sameEmail = normalizedEmail && user.email.toLowerCase() === normalizedEmail
        if (sameEmail) {
          return { ...user, role: "client", clientId }
        }

        if (user.clientId === clientId) {
          return { ...user, clientId: undefined }
        }

        return user
      }),
    }))
  }

  function addClient(payload: Omit<Client, "id" | "createdAt">) {
    const businessId = getCurrentBusinessId()

    if (useFirebaseAuth) {
      const normalizedPayload = {
        ...payload,
        email: payload.email?.trim().toLowerCase() || undefined,
      }

      return addDoc(collection(db, firestoreCollections.clients), {
        ...normalizedPayload,
        businessId,
        createdAt: new Date().toISOString(),
      }).then(async (clientRef) => {
        await syncClientUserLink(clientRef.id, normalizedPayload.email)
      })
    }

    const client: Client = {
      id: uuid("cl"),
      createdAt: new Date().toISOString(),
      businessId: businessId ?? undefined,
      ...payload,
      email: payload.email?.trim().toLowerCase() || undefined,
    }

    setData((current) => ({
      ...current,
      clients: [client, ...current.clients],
      auditLogs: [
        appendAudit(
          "CLIENT_CREATED",
          "client",
          client.id,
          `Client ${client.fullName} ajoute.`,
          currentUser?.fullName ?? "System"
        ),
        ...current.auditLogs,
      ],
    }))

    void syncClientUserLink(client.id, client.email)
  }

  function updateClient(id: string, payload: Omit<Client, "id" | "createdAt">) {
    const businessId = getCurrentBusinessId()

    if (useFirebaseAuth) {
      const normalizedPayload = {
        ...payload,
        email: payload.email?.trim().toLowerCase() || undefined,
        businessId: businessId ?? null,
      }

      return updateDoc(doc(db, firestoreCollections.clients, id), normalizedPayload).then(
        async () => {
          await syncClientUserLink(id, normalizedPayload.email)
        }
      )
    }

    setData((current) => ({
      ...current,
      clients: current.clients.map((client) =>
        client.id === id
          ? {
              ...client,
              ...payload,
              businessId: businessId ?? client.businessId,
              email: payload.email?.trim().toLowerCase() || undefined,
            }
          : client
      ),
      auditLogs: [
        appendAudit(
          "CLIENT_UPDATED",
          "client",
          id,
          `Client ${payload.fullName} modifie.`,
          currentUser?.fullName ?? "System"
        ),
        ...current.auditLogs,
      ],
    }))

    void syncClientUserLink(id, payload.email)
  }

  function deleteClient(id: string) {
    const linkedSale = data.sales.some((sale) => sale.clientId === id)
    const linkedDebt = data.debts.some((debt) => debt.clientId === id)

    if (linkedSale || linkedDebt) {
      throw new Error("Impossible de supprimer un client lie a des ventes ou dettes.")
    }

    if (useFirebaseAuth) {
      return deleteDoc(doc(db, firestoreCollections.clients, id))
    }

    setData((current) => ({
      ...current,
      clients: current.clients.filter((client) => client.id !== id),
      auditLogs: [
        appendAudit(
          "CLIENT_DELETED",
          "client",
          id,
          `Client ${id} supprime.`,
          currentUser?.fullName ?? "System"
        ),
        ...current.auditLogs,
      ],
    }))
  }

  function addProduct(payload: Omit<Product, "id" | "createdAt">) {
    const businessId = getCurrentBusinessId()

    if (useFirebaseAuth) {
      return addDoc(collection(db, firestoreCollections.products), {
        ...payload,
        businessId,
        createdAt: new Date().toISOString(),
      })
    }

    const product: Product = {
      id: uuid("pr"),
      createdAt: new Date().toISOString(),
      businessId: businessId ?? undefined,
      ...payload,
    }

    setData((current) => ({
      ...current,
      products: [product, ...current.products],
      auditLogs: [
        appendAudit(
          "PRODUCT_CREATED",
          "product",
          product.id,
          `Produit ${product.name} ajoute.`,
          currentUser?.fullName ?? "System"
        ),
        ...current.auditLogs,
      ],
    }))
  }

  function updateProduct(id: string, payload: Omit<Product, "id" | "createdAt">) {
    const businessId = getCurrentBusinessId()

    if (useFirebaseAuth) {
      return updateDoc(doc(db, firestoreCollections.products, id), {
        ...payload,
        businessId: businessId ?? null,
      })
    }

    setData((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === id
          ? { ...product, ...payload, businessId: businessId ?? product.businessId }
          : product
      ),
      auditLogs: [
        appendAudit(
          "PRODUCT_UPDATED",
          "product",
          id,
          `Produit ${payload.name} modifie.`,
          currentUser?.fullName ?? "System"
        ),
        ...current.auditLogs,
      ],
    }))
  }

  function deleteProduct(id: string) {
    const linkedSale = data.sales.some((sale) =>
      sale.items.some((item) => item.productId === id)
    )

    if (linkedSale) {
      throw new Error("Impossible de supprimer un produit deja vendu.")
    }

    if (useFirebaseAuth) {
      return deleteDoc(doc(db, firestoreCollections.products, id))
    }

    setData((current) => ({
      ...current,
      products: current.products.filter((product) => product.id !== id),
      auditLogs: [
        appendAudit(
          "PRODUCT_DELETED",
          "product",
          id,
          `Produit ${id} supprime.`,
          currentUser?.fullName ?? "System"
        ),
        ...current.auditLogs,
      ],
    }))
  }

  function ensureSuperAdmin() {
    if (!currentUser || currentUser.role !== "super_admin") {
      throw new Error("Seul le super admin peut administrer la plateforme SaaS.")
    }
  }

  function updateBusinessSettings(
    businessId: string,
    payload: { plan: Business["plan"]; status: Business["status"] }
  ) {
    ensureSuperAdmin()

    if (useFirebaseAuth) {
      return updateDoc(doc(db, firestoreCollections.businesses, businessId), {
        ...payload,
        updatedAt: serverTimestamp(),
      })
    }

    setData((current) => ({
      ...current,
      businesses: current.businesses.map((business) =>
        business.id === businessId ? { ...business, ...payload } : business
      ),
    }))
  }

  async function createBusiness(payload: {
    name: string
    ownerUid: string
    plan: Business["plan"]
    status: Business["status"]
  }) {
    ensureSuperAdmin()

    const name = payload.name.trim()
    if (!name) {
      throw new Error("Le nom du business est requis.")
    }

    const owner = data.users.find((entry) => entry.id === payload.ownerUid)
    if (!owner) {
      throw new Error("Utilisateur proprietaire introuvable.")
    }

    if (owner.role === "client" || owner.role === "super_admin") {
      throw new Error("Ce compte ne peut pas devenir proprietaire de business.")
    }

    const now = new Date().toISOString()

    if (useFirebaseAuth) {
      const businessRef = doc(collection(db, firestoreCollections.businesses))

      await setDoc(businessRef, {
        name,
        ownerUid: payload.ownerUid,
        plan: payload.plan,
        status: payload.status,
        createdAt: now,
        updatedAt: serverTimestamp(),
      })

      await updateDoc(doc(db, firestoreCollections.users, payload.ownerUid), {
        businessId: businessRef.id,
        role: "owner",
        updatedAt: serverTimestamp(),
      })

      return businessRef.id
    }

    const businessId = uuid("biz")

    setData((current) => ({
      ...current,
      businesses: [
        {
          id: businessId,
          name,
          ownerUid: payload.ownerUid,
          plan: payload.plan,
          status: payload.status,
          createdAt: now,
        },
        ...current.businesses,
      ],
      users: current.users.map((user) =>
        user.id === payload.ownerUid ? { ...user, businessId, role: "owner" } : user
      ),
    }))

    return businessId
  }

  async function assignUserToBusiness(userId: string, businessId: string) {
    ensureSuperAdmin()

    const user = data.users.find((entry) => entry.id === userId)
    if (!user) {
      throw new Error("Utilisateur introuvable.")
    }

    if (user.role === "client" || user.role === "super_admin") {
      throw new Error("Ce compte ne peut pas etre rattache a un business depuis cet ecran.")
    }

    const business = data.businesses.find((entry) => entry.id === businessId)
    if (!business) {
      throw new Error("Business introuvable.")
    }

    if (useFirebaseAuth) {
      await updateDoc(doc(db, firestoreCollections.users, userId), {
        businessId,
        updatedAt: serverTimestamp(),
      })

      if (user.role === "owner") {
        await updateDoc(doc(db, firestoreCollections.businesses, businessId), {
          ownerUid: userId,
          updatedAt: serverTimestamp(),
        })
      }

      return
    }

    setData((current) => ({
      ...current,
      users: current.users.map((entry) =>
        entry.id === userId ? { ...entry, businessId } : entry
      ),
      businesses: current.businesses.map((entry) =>
        entry.id === businessId && user.role === "owner"
          ? { ...entry, ownerUid: userId }
          : entry
      ),
    }))
  }

  function updateSubscriptionStatus(
    subscriptionId: string,
    status: Subscription["status"]
  ) {
    ensureSuperAdmin()

    if (useFirebaseAuth) {
      return updateDoc(doc(db, firestoreCollections.subscriptions, subscriptionId), {
        status,
        updatedAt: serverTimestamp(),
      })
    }

    setData((current) => ({
      ...current,
      subscriptions: current.subscriptions.map((subscription) =>
        subscription.id === subscriptionId ? { ...subscription, status } : subscription
      ),
    }))
  }

  function createSubscription(payload: {
    businessId: string
    planId: Subscription["planId"]
    status: Subscription["status"]
  }) {
    ensureSuperAdmin()

    const business = data.businesses.find((entry) => entry.id === payload.businessId)
    if (!business) {
      throw new Error("Business introuvable.")
    }

    if (data.subscriptions.some((entry) => entry.businessId === payload.businessId)) {
      throw new Error("Ce business possede deja un abonnement.")
    }

    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    if (useFirebaseAuth) {
      return addDoc(collection(db, firestoreCollections.subscriptions), {
        businessId: payload.businessId,
        planId: payload.planId,
        status: payload.status,
        startedAt: now,
        expiresAt,
        createdAt: now,
        updatedAt: serverTimestamp(),
      })
    }

    setData((current) => ({
      ...current,
      subscriptions: [
        {
          id: uuid("sub"),
          businessId: payload.businessId,
          planId: payload.planId,
          status: payload.status,
          startedAt: now,
          expiresAt,
          createdAt: now,
        },
        ...current.subscriptions,
      ],
    }))
  }

  function createSale(input: SaleInput) {
    if (!currentUser) {
      throw new Error("Utilisateur non connecte.")
    }

    const client = data.clients.find((entry) => entry.id === input.clientId)
    if (!client) {
      throw new Error("Client introuvable.")
    }

    if (!input.items.length) {
      throw new Error("Ajoute au moins un produit a la vente.")
    }

    if (useFirebaseAuth) {
      const now = new Date().toISOString()
      const saleRef = doc(collection(db, firestoreCollections.sales))

      return runTransaction(db, async (transaction) => {
        const clientRef = doc(db, firestoreCollections.clients, input.clientId)
        const clientSnapshot = await transaction.get(clientRef)

        if (!clientSnapshot.exists()) {
          throw new Error("Client introuvable.")
        }

        const clientData = clientSnapshot.data()
        const saleItems: SaleItem[] = []
        let totalAmount = 0

        for (const item of input.items) {
          const productRef = doc(db, firestoreCollections.products, item.productId)
          const productSnapshot = await transaction.get(productRef)

          if (!productSnapshot.exists()) {
            throw new Error("Produit introuvable dans la ligne de vente.")
          }

          const product = productSnapshot.data()
          const quantity = Number(item.quantity)

          if (quantity <= 0) {
            throw new Error(`Quantite invalide pour ${product.name}.`)
          }

          if (Number(product.stockQuantity ?? 0) < quantity) {
            throw new Error(`Stock insuffisant pour ${product.name}.`)
          }

          const saleItem: SaleItem = {
            id: doc(collection(db, firestoreCollections.saleItems)).id,
            productId: item.productId,
            productName: String(product.name ?? ""),
            quantity,
            unitPrice: Number(product.unitPrice ?? 0),
            lineTotal: Number(product.unitPrice ?? 0) * quantity,
          }

          totalAmount += saleItem.lineTotal
          saleItems.push(saleItem)

          transaction.update(productRef, {
            stockQuantity: Number(product.stockQuantity ?? 0) - quantity,
          })

          transaction.set(doc(collection(db, firestoreCollections.stockMovements)), {
            productId: item.productId,
            productName: saleItem.productName,
            movementType: "out",
            quantity,
            reason: `Vente ${saleRef.id}`,
            referenceId: saleRef.id,
            createdAt: now,
          })
        }

        const paidAmount = resolveInitialPaid(
          totalAmount,
          input.paymentType,
          input.initialPaid
        )
        const remainingAmount = computeRemainingAmount(totalAmount, paidAmount)
        const debtRef =
          remainingAmount > 0 ? doc(collection(db, firestoreCollections.debts)) : null

        transaction.set(saleRef, {
          businessId: clientData.businessId ?? getCurrentBusinessId() ?? null,
          clientId: input.clientId,
          clientName: String(clientData.fullName ?? ""),
          saleDate: input.saleDate || todayIsoDate(),
          paymentType: input.paymentType,
          totalAmount,
          paidAmount,
          remainingAmount,
          notes: input.notes,
          createdBy: currentUser.fullName,
          createdByName: currentUser.fullName,
          createdByUid: currentUser.id,
          debtId: debtRef?.id ?? null,
          items: saleItems,
          createdAt: now,
        })

        saleItems.forEach((item) => {
          transaction.set(doc(db, firestoreCollections.saleItems, item.id), {
            ...item,
            saleId: saleRef.id,
          })
        })

        if (debtRef) {
          transaction.set(debtRef, {
            businessId: clientData.businessId ?? getCurrentBusinessId() ?? null,
            saleId: saleRef.id,
            clientId: input.clientId,
            clientName: String(clientData.fullName ?? ""),
            initialAmount: totalAmount,
            totalPaid: paidAmount,
            remainingAmount,
            status: buildDebtStatus(remainingAmount, paidAmount),
            dueDate: input.saleDate || todayIsoDate(),
            createdAt: now,
          })
        }

        transaction.set(doc(collection(db, firestoreCollections.auditLogs)), {
          action: "SALE_CREATED",
          entityType: "sale",
          entityId: saleRef.id,
          actorName: currentUser.fullName,
          details:
            remainingAmount > 0
              ? `Vente creee avec dette ${debtRef?.id ?? ""}.`
              : "Vente creee sans dette.",
          createdAt: now,
        })
      })
    }

    const saleItems: SaleItem[] = input.items.map((item) => {
      const product = data.products.find((entry) => entry.id === item.productId)
      if (!product) {
        throw new Error("Produit introuvable dans la ligne de vente.")
      }

      if (item.quantity <= 0) {
        throw new Error(`Quantite invalide pour ${product.name}.`)
      }

      if (product.stockQuantity < item.quantity) {
        throw new Error(`Stock insuffisant pour ${product.name}.`)
      }

      return {
        id: uuid("sli"),
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.unitPrice,
        lineTotal: product.unitPrice * item.quantity,
      }
    })

    const totalAmount = saleItems.reduce((sum, item) => sum + item.lineTotal, 0)
    const paidAmount = resolveInitialPaid(
      totalAmount,
      input.paymentType,
      input.initialPaid
    )
    const remainingAmount = computeRemainingAmount(totalAmount, paidAmount)
    const saleId = uuid("sl")
    const debtId = remainingAmount > 0 ? uuid("db") : undefined
    const now = new Date().toISOString()

    const sale: Sale = {
      id: saleId,
      businessId: client.businessId ?? getCurrentBusinessId() ?? undefined,
      clientId: client.id,
      clientName: client.fullName,
      saleDate: input.saleDate || todayIsoDate(),
      paymentType: input.paymentType,
      totalAmount,
      paidAmount,
      remainingAmount,
      notes: input.notes,
      createdBy: currentUser.fullName,
      items: saleItems,
      debtId,
      createdAt: now,
    }

    const debt: Debt | null =
      remainingAmount > 0
        ? {
            id: debtId!,
            businessId: client.businessId ?? getCurrentBusinessId() ?? undefined,
            saleId,
            clientId: client.id,
            clientName: client.fullName,
            initialAmount: totalAmount,
            totalPaid: paidAmount,
            remainingAmount,
            status: buildDebtStatus(remainingAmount, paidAmount),
            dueDate: input.saleDate || todayIsoDate(),
            createdAt: now,
          }
        : null

    const stockMovements: StockMovement[] = saleItems.map((item) => ({
      id: uuid("stk"),
      productId: item.productId,
      productName: item.productName,
      movementType: "out",
      quantity: item.quantity,
      reason: `Vente ${saleId}`,
      referenceId: saleId,
      createdAt: now,
    }))

    setData((current) => ({
      ...current,
      sales: [sale, ...current.sales],
      debts: debt ? [debt, ...current.debts] : current.debts,
      products: current.products.map((product) => {
        const line = saleItems.find((item) => item.productId === product.id)
        return line
          ? { ...product, stockQuantity: product.stockQuantity - line.quantity }
          : product
      }),
      stockMovements: [...stockMovements, ...current.stockMovements],
      auditLogs: [
        appendAudit(
          "SALE_CREATED",
          "sale",
          saleId,
          debt
            ? `Vente creee avec dette ${debt.id} et reste ${remainingAmount}.`
            : "Vente creee sans dette.",
          currentUser.fullName
        ),
        ...current.auditLogs,
      ],
    }))
  }

  function addPayment(input: PaymentInput) {
    if (!currentUser) {
      throw new Error("Utilisateur non connecte.")
    }

    if (isClientRole(currentUser.role)) {
      throw new Error(
        "Les paiements clients doivent etre confirmes par le backend et son webhook fournisseur."
      )
    }

    const debt = data.debts.find((entry) => entry.id === input.debtId)
    if (!debt) {
      throw new Error("Dette introuvable.")
    }

    if (useFirebaseAuth) {
      return runTransaction(db, async (transaction) => {
        const debtRef = doc(db, firestoreCollections.debts, input.debtId)
        const debtSnapshot = await transaction.get(debtRef)

        if (!debtSnapshot.exists()) {
          throw new Error("Dette introuvable.")
        }

        const debtData = debtSnapshot.data()
        const { totalPaid, remainingAmount, status } = applyPaymentToDebt(
          {
            initialAmount: Number(debtData.initialAmount ?? 0),
            totalPaid: Number(debtData.totalPaid ?? 0),
            remainingAmount: Number(debtData.remainingAmount ?? 0),
          },
          input.amount
        )

        const paymentRef = doc(collection(db, firestoreCollections.payments))
        transaction.set(paymentRef, {
          businessId: String(debtData.businessId ?? ""),
          debtId: input.debtId,
          clientId: String(debtData.clientId ?? ""),
          clientName: String(debtData.clientName ?? ""),
          paymentDate: input.paymentDate || todayIsoDate(),
          amount: input.amount,
          method: input.method,
          reference: input.reference,
          note: input.note,
          createdBy: currentUser.fullName,
          createdByName: currentUser.fullName,
          createdByUid: currentUser.id,
          createdAt: new Date().toISOString(),
        })

        transaction.update(debtRef, {
          totalPaid,
          remainingAmount,
          status,
        })

        const saleRef = doc(db, firestoreCollections.sales, String(debtData.saleId ?? ""))
        transaction.update(saleRef, {
          paidAmount: totalPaid,
          remainingAmount,
        })

        transaction.set(doc(collection(db, firestoreCollections.auditLogs)), {
          action: "PAYMENT_RECORDED",
          entityType: "payment",
          entityId: paymentRef.id,
          actorName: currentUser.fullName,
          details: `Paiement de ${input.amount} ajoute a la dette ${input.debtId}.`,
          createdAt: new Date().toISOString(),
        })
      })
    }

    const payment: Payment = {
      id: uuid("pay"),
      businessId: debt.businessId,
      debtId: debt.id,
      clientId: debt.clientId,
      clientName: debt.clientName,
      paymentDate: input.paymentDate || todayIsoDate(),
      amount: input.amount,
      method: input.method,
      reference: input.reference,
      note: input.note,
      createdBy: currentUser.fullName,
      createdAt: new Date().toISOString(),
    }

    setData((current) => {
      const nextDebts = current.debts.map((entry) => {
        if (entry.id !== input.debtId) {
          return entry
        }

        const { totalPaid, remainingAmount, status } = applyPaymentToDebt(
          entry,
          input.amount
        )
        return {
          ...entry,
          totalPaid,
          remainingAmount,
          status,
        }
      })

      const nextDebt = nextDebts.find((entry) => entry.id === input.debtId)
      return {
        ...current,
        payments: [payment, ...current.payments],
        debts: nextDebts,
        sales: current.sales.map((sale) =>
          sale.debtId === input.debtId && nextDebt
            ? {
                ...sale,
                paidAmount: nextDebt.totalPaid,
                remainingAmount: nextDebt.remainingAmount,
              }
            : sale
        ),
        auditLogs: [
          appendAudit(
            "PAYMENT_RECORDED",
            "payment",
            payment.id,
            `Paiement de ${input.amount} ajoute a la dette ${debt.id}.`,
            currentUser.fullName
          ),
          ...current.auditLogs,
        ],
      }
    })
  }

  return {
    ...data,
    manageableUsers: currentUser && canManageUsers(currentUser.role) ? manageableUsers : data.users,
    currentUser,
    authReady,
    useFirebaseAuth,
    usersCollectionIssue,
    login,
    register,
    loginWithGoogle,
    logout,
    updateUserRole,
    toggleUserActive,
    addClient,
    updateClient,
    deleteClient,
    addProduct,
    updateProduct,
    deleteProduct,
    updateBusinessSettings,
    createBusiness,
    assignUserToBusiness,
    createSubscription,
    updateSubscriptionStatus,
    createSale,
    addPayment,
  }
}
