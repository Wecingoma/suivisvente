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
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
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
import type {
  AppDataSnapshot,
  Client,
  Debt,
  Payment,
  PaymentInput,
  Product,
  Sale,
  SaleInput,
  SaleItem,
  StockMovement,
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
    fullName: String(data.fullName ?? ""),
    phone: String(data.phone ?? ""),
    address: String(data.address ?? ""),
    notes: String(data.notes ?? ""),
    createdAt: asIsoString(data.createdAt),
  }
}

function mapProductDoc(id: string, data: DocumentData): Product {
  return {
    id,
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
    role:
      data.role === "admin" || data.role === "gestionnaire" || data.role === "vendeur"
        ? data.role
        : "vendeur",
    isActive: data.isActive !== false,
    authProvider: data.authProvider === "google" ? "google" : "password",
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

    if (currentUser.role !== "admin" && currentUser.role !== "gestionnaire") {
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
  fallbackFullName?: string
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
    isActive: true,
    authProvider:
      firebaseUser.providerData[0]?.providerId === "google.com" ? "google" : "password",
    createdAt: new Date().toISOString(),
  }
}

async function persistUserProfile(profile: User) {
  await setDoc(
    doc(db, "users", profile.id),
    {
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
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
    fallbackUser?.fullName
  )

  try {
    const snapshot = await getDoc(doc(db, "users", firebaseUser.uid))

    if (!snapshot.exists()) {
      try {
        await persistUserProfile(fallbackProfile)
      } catch (error) {
        console.warn("Impossible d'enregistrer le profil Firestore.", error)
      }
      return fallbackProfile
    }

    const data = snapshot.data()
    const profile = {
      id: firebaseUser.uid,
      fullName:
        typeof data.fullName === "string"
          ? data.fullName
          : fallbackProfile.fullName,
      email:
        typeof data.email === "string" && data.email
          ? data.email
          : fallbackProfile.email,
      role:
        data.role === "admin" || data.role === "gestionnaire" || data.role === "vendeur"
          ? data.role
          : fallbackRole,
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

    const unsubscribers = [
      onSnapshot(collection(db, firestoreCollections.clients), (snapshot) => {
        setData((current) => ({
          ...current,
          clients: snapshot.docs.map((entry) => mapClientDoc(entry.id, entry.data())),
        }))
      }),
      onSnapshot(collection(db, firestoreCollections.users), (snapshot) => {
        setUsersCollectionIssue(null)
        setData((current) => ({
          ...current,
          users: snapshot.docs
            .map((entry) => mapUserDoc(entry.id, entry.data()))
            .sort((left, right) => left.fullName.localeCompare(right.fullName)),
        }))
      }, (error) => {
        setUsersCollectionIssue(formatUsersCollectionIssue(currentUser, error))
        setData((current) => ({ ...current, users: [] }))
      }),
      onSnapshot(collection(db, firestoreCollections.products), (snapshot) => {
        setData((current) => ({
          ...current,
          products: snapshot.docs.map((entry) => mapProductDoc(entry.id, entry.data())),
        }))
      }),
      onSnapshot(collection(db, firestoreCollections.sales), (snapshot) => {
        setData((current) => ({
          ...current,
          sales: snapshot.docs
            .map((entry) => mapSaleDoc(entry.id, entry.data()))
            .sort((left, right) => right.saleDate.localeCompare(left.saleDate)),
        }))
      }),
      onSnapshot(collection(db, firestoreCollections.debts), (snapshot) => {
        setData((current) => ({
          ...current,
          debts: snapshot.docs
            .map((entry) => mapDebtDoc(entry.id, entry.data()))
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
        }))
      }),
      onSnapshot(collection(db, firestoreCollections.payments), (snapshot) => {
        setData((current) => ({
          ...current,
          payments: snapshot.docs
            .map((entry) => mapPaymentDoc(entry.id, entry.data()))
            .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)),
        }))
      }),
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
      ),
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
      ),
    ]

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

    if ((currentUser.role === "admin" || currentUser.role === "gestionnaire") && data.users.length === 0) {
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

  async function register(fullName: string, email: string, password: string) {
    if (!fullName.trim()) {
      throw new Error("Le nom complet est obligatoire.")
    }

    const registerLocally = () => {
      const exists = data.users.some(
        (entry) => entry.email.toLowerCase() === email.toLowerCase()
      )

      if (exists) {
        throw new Error("Cette adresse email est deja utilisee.")
      }

      const profile: User = {
        id: uuid("usr"),
        fullName: fullName.trim(),
        email,
        password,
        role: "vendeur",
        isActive: true,
        authProvider: "password",
        createdAt: new Date().toISOString(),
      }

      setData((current) => ({
        ...current,
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

      const profile = buildUserProfile(credential.user, "vendeur", fullName)

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

  async function fetchManageableUsers() {
    setManageableUsers(data.users)
    return data.users
  }

  function ensureAdminCanManageUsers() {
    if (!currentUser) {
      throw new Error("Utilisateur non connecte.")
    }

    if (currentUser.role !== "admin") {
      throw new Error("Seul un administrateur peut gerer les roles.")
    }
  }

  function countActiveAdmins(users: User[]) {
    return users.filter((user) => user.role === "admin" && user.isActive).length
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

    const activeAdmins = countActiveAdmins(usersSource)
    if (
      targetUser.id === currentUser?.id &&
      targetUser.role === "admin" &&
      role !== "admin" &&
      activeAdmins <= 1
    ) {
      throw new Error("Un seul admin actif ne peut pas perdre son role admin.")
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
      targetUser.role === "admin" &&
      targetUser.isActive &&
      !isActive &&
      activeAdmins <= 1
    ) {
      throw new Error("Le dernier administrateur actif ne peut pas etre desactive.")
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

  function addClient(payload: Omit<Client, "id" | "createdAt">) {
    if (useFirebaseAuth) {
      return addDoc(collection(db, firestoreCollections.clients), {
        ...payload,
        createdAt: new Date().toISOString(),
      })
    }

    const client: Client = {
      id: uuid("cl"),
      createdAt: new Date().toISOString(),
      ...payload,
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
  }

  function updateClient(id: string, payload: Omit<Client, "id" | "createdAt">) {
    if (useFirebaseAuth) {
      return updateDoc(doc(db, firestoreCollections.clients, id), payload)
    }

    setData((current) => ({
      ...current,
      clients: current.clients.map((client) =>
        client.id === id ? { ...client, ...payload } : client
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
    if (useFirebaseAuth) {
      return addDoc(collection(db, firestoreCollections.products), {
        ...payload,
        createdAt: new Date().toISOString(),
      })
    }

    const product: Product = {
      id: uuid("pr"),
      createdAt: new Date().toISOString(),
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
    if (useFirebaseAuth) {
      return updateDoc(doc(db, firestoreCollections.products, id), payload)
    }

    setData((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === id ? { ...product, ...payload } : product
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
    manageableUsers: currentUser?.role === "admin" ? manageableUsers : data.users,
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
    createSale,
    addPayment,
  }
}
