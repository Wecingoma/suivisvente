import { useEffect, useState, type FormEvent } from "react"
import { LayoutDashboard, LogOut, X } from "lucide-react"

import { AuthScreen } from "@/components/app/auth-screen"
import {
  navigation,
  screenTitles,
  type NavItem,
  type ScreenId,
} from "@/components/app/constants"
import { StatBadge } from "@/components/app/shared"
import {
  ClientsView,
  DashboardView,
  DebtsView,
  PaymentsView,
  ProductsView,
  ReportsView,
  SalesView,
} from "@/components/app/views"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ToastViewport, type ToastItem } from "@/components/ui/toast"
import { useCommercialApp } from "@/lib/app-state"
import { formatCurrency, todayIsoDate } from "@/lib/format"
import type { User } from "@/types"

function App() {
  const app = useCommercialApp()
  const [screen, setScreen] = useState<ScreenId>("dashboard")
  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [registerName, setRegisterName] = useState("")
  const [loginEmail, setLoginEmail] = useState("admin@marchervente.app")
  const [loginPassword, setLoginPassword] = useState("admin123")
  const [authBusy, setAuthBusy] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [notice, setNotice] = useState<{
    type: "success" | "error"
    title: string
    message: string
  } | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const currentRole = app.currentUser?.role
  const availableNavigation = app.currentUser
    ? navigation.filter((item) => item.roles.includes(currentRole!))
    : []

  useEffect(() => {
    if (!app.currentUser || availableNavigation.length === 0) {
      return
    }

    if (!availableNavigation.some((item) => item.id === screen)) {
      setScreen(availableNavigation[0].id)
    }
  }, [app.currentUser, availableNavigation, screen])

  const totalDebtOpen = app.debts.reduce(
    (sum, debt) => sum + (debt.status === "paid" ? 0 : debt.remainingAmount),
    0
  )
  const salesToday = app.sales.filter((sale) => sale.saleDate === todayIsoDate())
  const dashboardDebtors = [...app.debts]
    .filter((debt) => debt.status !== "paid")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5)

  function pushToast(type: ToastItem["type"], title: string, message: string) {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, type, title, message }])

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4500)
  }

  function showSuccess(title: string, message: string) {
    setNotice({ type: "success", title, message })
    pushToast("success", title, message)
  }

  function showError(error: unknown) {
    const message =
      error instanceof Error ? error.message : "Une erreur inattendue est survenue."

    setNotice({
      type: "error",
      title: "Operation refusee",
      message,
    })
    pushToast("error", "Operation refusee", message)
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    try {
      if (authMode === "register") {
        await app.register(registerName, loginEmail, loginPassword)
        pushToast("success", "Compte cree", "Inscription reussie et session ouverte.")
      } else {
        await app.login(loginEmail, loginPassword)
        pushToast("success", "Connexion reussie", "Bienvenue dans l'application.")
      }
      setLoginError("")
      setNotice(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connexion echouee."
      setLoginError(message)
      pushToast("error", "Echec d'authentification", message)
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleGoogleLogin() {
    setAuthBusy(true)
    try {
      await app.loginWithGoogle()
      setLoginError("")
      setNotice(null)
      pushToast("success", "Connexion Google", "Connexion reussie avec Google.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connexion Google echouee."
      setLoginError(message)
      pushToast("error", "Connexion Google", message)
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogout() {
    await app.logout()
    setMobileSidebarOpen(false)
    setNotice(null)
    setScreen("dashboard")
    pushToast("success", "Deconnexion", "La session a ete fermee.")
  }

  function handleScreenChange(nextScreen: ScreenId) {
    setScreen(nextScreen)
    setMobileSidebarOpen(false)
  }

  if (!app.authReady) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.15),_transparent_26%),linear-gradient(180deg,_#f5fbff_0%,_#ecf4ff_100%)] px-6 py-10 text-slate-950">
        <div className="rounded-[2rem] border border-white bg-white/80 px-8 py-10 text-center shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)] backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">
            Authentification
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Verification de la session
          </h1>
        </div>
      </main>
    )
  }

  if (!app.currentUser) {
    return (
      <>
        <ToastViewport
          toasts={toasts}
          onClose={(id) =>
            setToasts((current) => current.filter((toast) => toast.id !== id))
          }
        />
        <AuthScreen
          authMode={authMode}
          registerName={registerName}
          loginEmail={loginEmail}
          loginPassword={loginPassword}
          loginError={loginError}
          authBusy={authBusy}
          useFirebaseAuth={app.useFirebaseAuth}
          onSwitchMode={(mode) => {
            setAuthMode(mode)
            setLoginError("")
          }}
          onRegisterNameChange={setRegisterName}
          onEmailChange={setLoginEmail}
          onPasswordChange={setLoginPassword}
          onSubmit={handleAuthSubmit}
          onGoogleLogin={handleGoogleLogin}
          onPickDemo={(email, password) => {
            setAuthMode("login")
            setLoginEmail(email)
            setLoginPassword(password)
          }}
        />
      </>
    )
  }

  return (
    <main className="min-h-svh bg-[linear-gradient(180deg,_#f8fafc_0%,_#f5f3ff_100%)] text-slate-950">
      <ToastViewport
        toasts={toasts}
        onClose={(id) =>
          setToasts((current) => current.filter((toast) => toast.id !== id))
        }
      />

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col border-r border-white/10 bg-slate-950 p-5 text-white shadow-[0_35px_90px_-60px_rgba(15,23,42,0.95)]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                Dashboard
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl text-white hover:bg-white/10 hover:text-white"
                onClick={() => setMobileSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarContent
              currentUser={app.currentUser}
              availableNavigation={availableNavigation}
              screen={screen}
              onScreenChange={handleScreenChange}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-svh flex-col lg:flex-row">
        <aside className="hidden border-r border-white/10 bg-slate-950 text-white shadow-[0_35px_90px_-60px_rgba(15,23,42,0.95)] lg:flex lg:min-h-svh lg:w-80 lg:flex-col">
          <SidebarContent
            currentUser={app.currentUser}
            availableNavigation={availableNavigation}
            screen={screen}
            onScreenChange={handleScreenChange}
            onLogout={handleLogout}
            desktop
          />
        </aside>

        <section className="flex-1 space-y-6 px-4 py-4 lg:px-6 lg:py-6">
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-slate-200 bg-white/90 px-4 text-slate-950 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.45)]"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">
                {app.currentUser.fullName}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">
                {app.currentUser.role}
              </p>
            </div>
          </div>

          <header className="rounded-[2rem] border border-white bg-white/85 p-6 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.5)] backdrop-blur">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">
                  Tableau de gestion
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  {screenTitles[screen]}
                </h1>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatBadge label="Clients" value={String(app.clients.length)} />
                <StatBadge
                  label="Ventes du jour"
                  value={formatCurrency(
                    salesToday.reduce((sum, sale) => sum + sale.totalAmount, 0)
                  )}
                />
                <StatBadge
                  label="Dettes ouvertes"
                  value={formatCurrency(totalDebtOpen)}
                />
              </div>
            </div>
          </header>

          {notice ? (
            <Alert variant={notice.type === "error" ? "destructive" : "default"}>
              <AlertTitle>{notice.title}</AlertTitle>
              <AlertDescription>{notice.message}</AlertDescription>
            </Alert>
          ) : null}

          {app.usersCollectionIssue ? (
            <Alert variant="destructive">
              <AlertTitle>Lecture des utilisateurs impossible</AlertTitle>
              <AlertDescription>{app.usersCollectionIssue}</AlertDescription>
            </Alert>
          ) : null}

          {screen === "dashboard" ? (
            <DashboardView
              currentUser={app.currentUser}
              users={app.manageableUsers}
              clients={app.clients}
              products={app.products}
              sales={app.sales}
              payments={app.payments}
              debts={app.debts}
              debtors={dashboardDebtors}
              auditLogs={app.auditLogs.slice(0, 8)}
              onUpdateUserRole={async (userId, role) => {
                try {
                  await app.updateUserRole(userId, role)
                  showSuccess("Role mis a jour", "Les acces du compte ont ete modifies.")
                } catch (error) {
                  showError(error)
                }
              }}
              onToggleUserActive={async (userId, isActive) => {
                try {
                  await app.toggleUserActive(userId, isActive)
                  showSuccess(
                    isActive ? "Compte reactive" : "Compte desactive",
                    "Le statut utilisateur a ete mis a jour."
                  )
                } catch (error) {
                  showError(error)
                }
              }}
            />
          ) : null}

          {screen === "clients" ? (
            <ClientsView
              clients={app.clients}
              sales={app.sales}
              payments={app.payments}
              onCreate={async (payload) => {
                try {
                  await app.addClient(payload)
                  showSuccess("Client ajoute", "Le client a ete enregistre.")
                } catch (error) {
                  showError(error)
                }
              }}
              onUpdate={async (id, payload) => {
                try {
                  await app.updateClient(id, payload)
                  showSuccess("Client modifie", "Les informations ont ete mises a jour.")
                } catch (error) {
                  showError(error)
                }
              }}
              onDelete={async (id) => {
                try {
                  await app.deleteClient(id)
                  showSuccess("Client supprime", "Le client a ete retire.")
                } catch (error) {
                  showError(error)
                }
              }}
            />
          ) : null}

          {screen === "products" ? (
            <ProductsView
              products={app.products}
              stockMovements={app.stockMovements}
              onCreate={async (payload) => {
                try {
                  await app.addProduct(payload)
                  showSuccess("Produit ajoute", "Le produit a ete enregistre.")
                } catch (error) {
                  showError(error)
                }
              }}
              onUpdate={async (id, payload) => {
                try {
                  await app.updateProduct(id, payload)
                  showSuccess("Produit modifie", "Le produit a ete mis a jour.")
                } catch (error) {
                  showError(error)
                }
              }}
              onDelete={async (id) => {
                try {
                  await app.deleteProduct(id)
                  showSuccess("Produit supprime", "Le produit a ete retire.")
                } catch (error) {
                  showError(error)
                }
              }}
            />
          ) : null}

          {screen === "sales" ? (
            <SalesView
              clients={app.clients}
              products={app.products}
              sales={app.sales}
              onCreate={async (payload) => {
                try {
                  await app.createSale(payload)
                  showSuccess(
                    "Vente validee",
                    "La vente, le stock et la dette eventuelle ont ete mis a jour."
                  )
                } catch (error) {
                  showError(error)
                }
              }}
            />
          ) : null}

          {screen === "debts" ? (
            <DebtsView debts={app.debts} sales={app.sales} />
          ) : null}

          {screen === "payments" ? (
            <PaymentsView
              debts={app.debts}
              payments={app.payments}
              onCreate={async (payload) => {
                try {
                  await app.addPayment(payload)
                  showSuccess(
                    "Paiement enregistre",
                    "La dette et le reste a payer ont ete recalcules."
                  )
                } catch (error) {
                  showError(error)
                }
              }}
            />
          ) : null}

          {screen === "reports" ? (
            <ReportsView
              clients={app.clients}
              products={app.products}
              sales={app.sales}
              debts={app.debts}
              payments={app.payments}
            />
          ) : null}
        </section>
      </div>
    </main>
  )
}

function SidebarContent({
  currentUser,
  availableNavigation,
  screen,
  onScreenChange,
  onLogout,
  desktop = false,
}: {
  currentUser: User
  availableNavigation: NavItem[]
  screen: ScreenId
  onScreenChange: (screen: ScreenId) => void
  onLogout: () => void | Promise<void>
  desktop?: boolean
}) {
  return (
    <div className={`flex h-full flex-col ${desktop ? "p-6" : ""}`}>
      <div className="border-b border-white/10 pb-5">
        <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
          Marcher Vente
        </p>
        <h2 className="mt-3 text-2xl font-semibold">Gestion commerciale</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {currentUser.fullName}
          <br />
          <span className="text-cyan-300">{currentUser.role}</span>
        </p>
      </div>

      <nav className="mt-5 grid gap-2">
        {availableNavigation.map((item) => {
          const Icon = item.icon
          const active = item.id === screen

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onScreenChange(item.id)}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                active
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-200 hover:bg-white/10"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto" />

      <div className="mt-6 rounded-[1.5rem] border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
        Backend cible: Firebase Auth + Cloud Firestore.
      </div>

      <Button
        variant="outline"
        className="mt-4 h-11 w-full rounded-2xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
        onClick={onLogout}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Deconnexion
      </Button>
    </div>
  )
}

export default App
