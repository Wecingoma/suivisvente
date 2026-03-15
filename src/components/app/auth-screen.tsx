import type { FormEvent } from "react"
import {
  ArrowRightLeft,
  BookOpen,
  Chrome,
  FileSpreadsheet,
  Mail,
  ShieldCheck,
  ShoppingCart,
  UserPlus,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DemoAccount, FeatureCard, Field } from "@/components/app/shared"

export function AuthScreen({
  authMode,
  registerName,
  registerAccountType,
  registerBusinessName,
  loginEmail,
  loginPassword,
  loginError,
  authBusy,
  useFirebaseAuth,
  onSwitchMode,
  onRegisterNameChange,
  onRegisterAccountTypeChange,
  onRegisterBusinessNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGoogleLogin,
  onPickDemo,
}: {
  authMode: "login" | "register"
  registerName: string
  registerAccountType: "client" | "owner"
  registerBusinessName: string
  loginEmail: string
  loginPassword: string
  loginError: string
  authBusy: boolean
  useFirebaseAuth: boolean
  onSwitchMode: (mode: "login" | "register") => void
  onRegisterNameChange: (value: string) => void
  onRegisterAccountTypeChange: (value: "client" | "owner") => void
  onRegisterBusinessNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onGoogleLogin: () => void
  onPickDemo: (email: string, password: string) => void
}) {
  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.15),_transparent_26%),linear-gradient(180deg,_#f5fbff_0%,_#ecf4ff_100%)] px-6 py-10 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-cyan-100 bg-slate-950 p-8 text-white shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)] md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            <ShieldCheck className="h-4 w-4" />
            Authentification et roles Firebase
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
            Marcher Vente pilote les ventes, credits et remboursements.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Cette base React simule deja les ecrans metier et leurs calculs.
            Le backend cible est Firebase Auth et Cloud Firestore.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <FeatureCard
              icon={ShoppingCart}
              title="Ventes multi-lignes"
              text="Une vente peut contenir plusieurs produits et declencher une dette automatiquement."
            />
            <FeatureCard
              icon={ArrowRightLeft}
              title="Paiements partiels"
              text="Chaque paiement met a jour le solde restant et le statut de la dette."
            />
            <FeatureCard
              icon={BookOpen}
              title="Historique complet"
              text="Audit, mouvements de stock, dettes et remboursements sont historises."
            />
            <FeatureCard
              icon={FileSpreadsheet}
              title="Rapports exportables"
              text="Le frontend exporte deja les syntheses CSV en attendant le PDF serveur."
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white bg-white/80 p-8 shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)] backdrop-blur md:p-10">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">
              Acces securise
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Connexion et creation de compte
            </h2>
            <p className="text-sm leading-7 text-slate-600">
              Connecte-toi avec Google ou avec email et mot de passe. Si Firebase
              Auth est desactive, l'application utilise les comptes de demo locaux.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 rounded-[1.5rem] bg-slate-100 p-1">
            <button
              type="button"
              className={`rounded-[1.2rem] px-4 py-3 text-sm font-semibold transition ${
                authMode === "login"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500"
              }`}
              onClick={() => onSwitchMode("login")}
            >
              <span className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Connexion
              </span>
            </button>
            <button
              type="button"
              className={`rounded-[1.2rem] px-4 py-3 text-sm font-semibold transition ${
                authMode === "register"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500"
              }`}
              onClick={() => onSwitchMode("register")}
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Inscription
              </span>
            </button>
          </div>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            {authMode === "register" ? (
              <>
                <Field label="Nom complet">
                  <input
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-cyan-500"
                    value={registerName}
                    onChange={(event) => onRegisterNameChange(event.target.value)}
                    required
                  />
                </Field>

                <Field label="Type de compte">
                  <div className="grid grid-cols-2 gap-3 rounded-[1.25rem] bg-slate-100 p-1">
                    <button
                      type="button"
                      className={`rounded-[1rem] px-4 py-3 text-sm font-semibold transition ${
                        registerAccountType === "owner"
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-500"
                      }`}
                      onClick={() => onRegisterAccountTypeChange("owner")}
                    >
                      Commerce
                    </button>
                    <button
                      type="button"
                      className={`rounded-[1rem] px-4 py-3 text-sm font-semibold transition ${
                        registerAccountType === "client"
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-500"
                      }`}
                      onClick={() => onRegisterAccountTypeChange("client")}
                    >
                      Client
                    </button>
                  </div>
                  <p className="text-sm leading-6 text-slate-500">
                    Si le compte est un commerce, le business doit etre cree maintenant.
                  </p>
                </Field>

                {registerAccountType === "owner" ? (
                  <Field label="Nom du business">
                    <input
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-cyan-500"
                      value={registerBusinessName}
                      onChange={(event) => onRegisterBusinessNameChange(event.target.value)}
                      placeholder="Boutique Nzambe"
                      required
                    />
                  </Field>
                ) : null}
              </>
            ) : null}

            <Field label="Email">
              <input
                type="email"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-cyan-500"
                value={loginEmail}
                onChange={(event) => onEmailChange(event.target.value)}
                required
              />
            </Field>

            <Field label="Mot de passe">
              <input
                type="password"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-cyan-500"
                value={loginPassword}
                onChange={(event) => onPasswordChange(event.target.value)}
                minLength={6}
                required
              />
            </Field>

            {loginError ? (
              <Alert variant="destructive">
                <AlertTitle>Echec de connexion</AlertTitle>
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-900"
              disabled={authBusy}
            >
              {authBusy
                ? "Traitement..."
                : authMode === "register"
                  ? "Creer le compte"
                  : "Se connecter"}
            </Button>
          </form>

          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-2xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              onClick={onGoogleLogin}
              disabled={authBusy || !useFirebaseAuth}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Continuer avec Google
            </Button>
          </div>

          <div className="mt-8 grid gap-3">
            <DemoAccount
              role="Admin"
              email="admin@marchervente.app"
              password="admin123"
              onPick={() => onPickDemo("admin@marchervente.app", "admin123")}
            />
            <DemoAccount
              role="Gestionnaire"
              email="gestion@marchervente.app"
              password="manager123"
              onPick={() => onPickDemo("gestion@marchervente.app", "manager123")}
            />
            <DemoAccount
              role="Vendeur"
              email="vendeur@marchervente.app"
              password="seller123"
              onPick={() => onPickDemo("vendeur@marchervente.app", "seller123")}
            />
            <DemoAccount
              role="Client"
              email="client@marchervente.app"
              password="client123"
              onPick={() => onPickDemo("client@marchervente.app", "client123")}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
