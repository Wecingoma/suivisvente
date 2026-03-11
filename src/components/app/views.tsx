import { useState, type FormEvent } from "react"
import {
  BadgeDollarSign,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Search,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react"

import {
  debtLabels,
  paymentMethodLabels,
  paymentTypeLabels,
  statusClasses,
} from "@/components/app/constants"
import {
  EmptyState,
  Field,
  MiniMetric,
  MiniReportCard,
  SectionCard,
} from "@/components/app/shared"
import { Button } from "@/components/ui/button"
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  startOfDay,
  todayIsoDate,
} from "@/lib/format"
import type {
  Client,
  Debt,
  DebtStatus,
  PaymentInput,
  PaymentMethod,
  PaymentType,
  Product,
  SaleInput,
  User,
  UserRole,
} from "@/types"

function exportCsv(filename: string, rows: string[][]) {
  const csvContent = rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function DashboardView({
  currentUser,
  users,
  clients,
  products,
  sales,
  payments,
  debts,
  debtors,
  auditLogs,
  onUpdateUserRole,
  onToggleUserActive,
}: {
  currentUser: User
  users: User[]
  clients: Client[]
  products: Product[]
  sales: {
    id: string
    clientId: string
    clientName: string
    saleDate: string
    paymentType: PaymentType
    totalAmount: number
    paidAmount: number
    remainingAmount: number
  }[]
  payments: {
    id: string
    clientId: string
    clientName: string
    paymentDate: string
    amount: number
    method: PaymentMethod
  }[]
  debts: Debt[]
  debtors: Debt[]
  auditLogs: {
    id: string
    action: string
    actorName: string
    details: string
    createdAt: string
  }[]
  onUpdateUserRole: (userId: string, role: UserRole) => void
  onToggleUserActive: (userId: string, isActive: boolean) => void
}) {
  const [range, setRange] = useState<"today" | "week" | "month" | "all">("today")

  const now = new Date()
  const today = startOfDay(now)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - 7)
  const monthStart = new Date(today)
  monthStart.setMonth(today.getMonth() - 1)

  function isWithinRange(value: string) {
    if (range === "all") {
      return true
    }

    const date = startOfDay(new Date(value))

    if (range === "today") {
      return date.getTime() === today.getTime()
    }

    if (range === "week") {
      return date >= weekStart
    }

    return date >= monthStart
  }

  const salesInRange = sales.filter((sale) => isWithinRange(sale.saleDate))
  const paymentsInRange = payments.filter((payment) => isWithinRange(payment.paymentDate))
  const recentLogs = auditLogs.filter((log) => isWithinRange(log.createdAt)).slice(0, 8)
  const totalSalesAmount = salesInRange.reduce((sum, sale) => sum + sale.totalAmount, 0)
  const totalCollected = paymentsInRange.reduce((sum, payment) => sum + payment.amount, 0)
  const totalOpenDebt = debts.reduce(
    (sum, debt) => sum + (debt.status === "paid" ? 0 : debt.remainingAmount),
    0
  )
  const creditSalesCount = salesInRange.filter((sale) => sale.paymentType !== "cash").length
  const averageTicket =
    salesInRange.length > 0 ? totalSalesAmount / salesInRange.length : 0
  const lowStockProducts = products
    .filter((product) => product.stockQuantity <= 10)
    .sort((left, right) => left.stockQuantity - right.stockQuantity)
    .slice(0, 5)

  const topClients = clients
    .map((client) => {
      const clientSales = salesInRange.filter((sale) => sale.clientId === client.id)
      return {
        id: client.id,
        fullName: client.fullName,
        salesCount: clientSales.length,
        totalAmount: clientSales.reduce((sum, sale) => sum + sale.totalAmount, 0),
      }
    })
    .filter((client) => client.salesCount > 0)
    .sort((left, right) => right.totalAmount - left.totalAmount)
    .slice(0, 5)

  const paymentsByMethod = (["cash", "mobile_money", "bank", "card"] as const).map(
    (method) => ({
      method,
      label: paymentMethodLabels[method],
      amount: paymentsInRange
        .filter((payment) => payment.method === method)
        .reduce((sum, payment) => sum + payment.amount, 0),
    })
  )

  const debtRecoveryRate =
    debts.reduce((sum, debt) => sum + debt.initialAmount, 0) > 0
      ? (debts.reduce((sum, debt) => sum + debt.totalPaid, 0) /
          debts.reduce((sum, debt) => sum + debt.initialAmount, 0)) *
        100
      : 0
  const visibleUsers = [...users].sort((left, right) =>
    left.fullName.localeCompare(right.fullName)
  )
  const adminUsers = visibleUsers.filter((user) => user.role === "admin" && user.isActive)

  return (
    <div className="grid gap-6">
      <SectionCard
        title="Pilotage instantane"
        subtitle="Le dashboard se recalcule en direct selon la periode selectionnee."
      >
        <div className="flex flex-wrap gap-3">
          {(["today", "week", "month", "all"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={range === value ? "default" : "outline"}
              className={`rounded-full px-4 ${
                range === value ? "bg-slate-950 text-white" : ""
              }`}
              onClick={() => setRange(value)}
            >
              {value === "today" && "Aujourd'hui"}
              {value === "week" && "7 jours"}
              {value === "month" && "30 jours"}
              {value === "all" && "Tout"}
            </Button>
          ))}
        </div>
      </SectionCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardStatCard label="Nombre de clients" value={String(clients.length)} icon={Users} />
        <DashboardStatCard label="Nombre de produits" value={String(products.length)} icon={PackageSearch} />
        <DashboardStatCard label="Total des ventes" value={formatCurrency(totalSalesAmount)} icon={ReceiptText} />
        <DashboardStatCard label="Dettes en cours" value={formatCurrency(totalOpenDebt)} icon={Wallet} />
        <DashboardStatCard label="Total encaisse" value={formatCurrency(totalCollected)} icon={BadgeDollarSign} />
      </section>

      {currentUser.role === "admin" ? (
        <SectionCard
          title="Utilisateurs et roles"
          subtitle="Liste complete des utilisateurs, avec leur role et leur statut d'acces au dashboard."
        >
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <MiniReportCard label="Utilisateurs" value={String(visibleUsers.length)} />
            <MiniReportCard
              label="Admins actifs"
              value={String(adminUsers.length)}
            />
            <MiniReportCard
              label="Comptes inactifs"
              value={String(visibleUsers.filter((user) => !user.isActive).length)}
            />
          </div>

          <div className="mb-4 hidden rounded-[1.25rem] bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 lg:grid lg:grid-cols-[minmax(0,1fr)_220px_160px] lg:gap-4">
            <span>Utilisateur</span>
            <span>Role</span>
            <span>Statut</span>
          </div>

          <div className="grid gap-3">
            {visibleUsers.length ? (
              visibleUsers.map((user) => {
                const isLastActiveAdmin =
                  user.role === "admin" && user.isActive && adminUsers.length <= 1

                return (
                  <div
                    key={user.id}
                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{user.fullName}</p>
                          {user.id === currentUser.id ? (
                            <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-800">
                              Vous
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              user.isActive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {user.isActive ? "Actif" : "Inactif"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                          {user.authProvider === "google" ? "Google" : "Mot de passe"}
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_160px]">
                        <select
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-cyan-500"
                          value={user.role}
                          disabled={isLastActiveAdmin}
                          onChange={(event) =>
                            onUpdateUserRole(user.id, event.target.value as UserRole)
                          }
                        >
                          <option value="admin">Admin</option>
                          <option value="gestionnaire">Gestionnaire</option>
                          <option value="vendeur">Vendeur</option>
                        </select>
                        <Button
                          type="button"
                          variant={user.isActive ? "outline" : "default"}
                          className={`rounded-2xl px-5 ${
                            user.isActive ? "" : "bg-slate-950 text-white hover:bg-slate-900"
                          }`}
                          disabled={isLastActiveAdmin}
                          onClick={() => onToggleUserActive(user.id, !user.isActive)}
                        >
                          {user.isActive ? "Desactiver" : "Reactiver"}
                        </Button>
                      </div>
                    </div>

                    {isLastActiveAdmin ? (
                      <div className="mt-3 flex items-center gap-2 text-sm text-amber-700">
                        <ShieldCheck className="h-4 w-4" />
                        <span>Le dernier administrateur actif est protege.</span>
                      </div>
                    ) : null}
                  </div>
                )
              })
            ) : (
              <EmptyState text="Aucun utilisateur disponible." />
            )}
          </div>
        </SectionCard>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniReportCard label="Ventes a credit" value={String(creditSalesCount)} />
        <MiniReportCard label="Ticket moyen" value={formatCurrency(averageTicket)} />
        <MiniReportCard
          label="Paiements saisis"
          value={String(paymentsInRange.length)}
        />
        <MiniReportCard
          label="Taux de recouvrement"
          value={`${debtRecoveryRate.toFixed(1)}%`}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Clients debiteurs recents"
          subtitle="Les clients dont la dette n'est pas encore soldee."
        >
          <div className="grid gap-3">
            {debtors.length ? (
              debtors.map((debt) => (
                <div
                  key={debt.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{debt.clientName}</p>
                      <p className="text-sm text-slate-500">
                        Echeance {formatDate(debt.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                          debt.status
                        )}`}
                      >
                        {debtLabels[debt.status]}
                      </span>
                      <strong className="text-lg text-slate-900">
                        {formatCurrency(debt.remainingAmount)}
                      </strong>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="Aucune dette ouverte pour le moment." />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Journal des operations"
          subtitle="Trace recente des ventes, paiements et modifications critiques."
        >
          <div className="grid gap-3">
            {recentLogs.length ? recentLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-slate-900">{log.action}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {formatDateTime(log.createdAt)}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{log.details}</p>
                <p className="mt-2 text-xs text-cyan-700">{log.actorName}</p>
              </div>
            )) : <EmptyState text="Aucune operation sur cette periode." />}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Top clients"
          subtitle="Clients les plus actifs sur la periode selectionnee."
        >
          <div className="grid gap-3">
            {topClients.length ? (
              topClients.map((client) => (
                <div
                  key={client.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{client.fullName}</p>
                      <p className="text-sm text-slate-500">
                        {client.salesCount} vente(s)
                      </p>
                    </div>
                    <strong>{formatCurrency(client.totalAmount)}</strong>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="Aucune vente sur cette periode." />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Canaux d'encaissement"
          subtitle="Repartition des paiements saisis par methode."
        >
          <div className="grid gap-3">
            {paymentsByMethod.map((entry) => (
              <div
                key={entry.method}
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold">{entry.label}</p>
                  <strong>{formatCurrency(entry.amount)}</strong>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-cyan-600 transition-all"
                    style={{
                      width: `${
                        totalCollected > 0 ? (entry.amount / totalCollected) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Alertes stock"
          subtitle="Produits a surveiller avant rupture."
        >
          <div className="grid gap-3">
            {lowStockProducts.length ? (
              lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-sm text-slate-500">
                        {formatCurrency(product.unitPrice)}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      Stock {product.stockQuantity}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="Aucune alerte de stock." />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function DashboardStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof LayoutDashboard
}) {
  return (
    <div className="rounded-[2rem] border border-white bg-white/85 p-5 shadow-[0_25px_60px_-50px_rgba(15,23,42,0.45)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export function ClientsView({
  clients,
  sales,
  payments,
  onCreate,
  onUpdate,
  onDelete,
}: {
  clients: Client[]
  sales: {
    id: string
    clientId: string
    clientName?: string
    saleDate: string
    paymentType?: PaymentType
    totalAmount: number
    paidAmount?: number
    remainingAmount: number
    notes?: string
  }[]
  payments: {
    id: string
    clientId: string
    clientName?: string
    amount: number
    paymentDate: string
    method?: PaymentMethod
    reference?: string
    note?: string
  }[]
  onCreate: (payload: Omit<Client, "id" | "createdAt">) => void
  onUpdate: (id: string, payload: Omit<Client, "id" | "createdAt">) => void
  onDelete: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const [debtFilter, setDebtFilter] = useState<"all" | "debtors" | "clear">("all")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    clients[0]?.id ?? null
  )
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    notes: "",
  })

  const clientSummaries = clients
    .map((client) => {
      const clientSales = sales.filter((sale) => sale.clientId === client.id)
      const clientPayments = payments.filter((payment) => payment.clientId === client.id)

      return {
        client,
        salesCount: clientSales.length,
        paymentsCount: clientPayments.length,
        totalSalesAmount: clientSales.reduce((sum, sale) => sum + sale.totalAmount, 0),
        totalRemaining: clientSales.reduce((sum, sale) => sum + sale.remainingAmount, 0),
        totalPaid: clientPayments.reduce((sum, payment) => sum + payment.amount, 0),
      }
    })
    .map((entry) => ({
      ...entry,
      isDebtor: entry.totalRemaining > 0,
    }))
    .filter((entry) => {
      const matchesSearch = `${entry.client.fullName} ${entry.client.phone} ${entry.client.address}`
        .toLowerCase()
        .includes(search.toLowerCase())

      if (!matchesSearch) {
        return false
      }

      if (debtFilter === "debtors") {
        return entry.isDebtor
      }

      if (debtFilter === "clear") {
        return !entry.isDebtor
      }

      return true
    })
    .sort((left, right) => {
      if (left.isDebtor !== right.isDebtor) {
        return Number(right.isDebtor) - Number(left.isDebtor)
      }

      return right.totalSalesAmount - left.totalSalesAmount
    })

  const selectedSummary =
    clientSummaries.find((entry) => entry.client.id === selectedClientId) ??
    clientSummaries[0] ??
    null
  const selectedClient = selectedSummary?.client ?? null

  const clientSales = sales
    .filter((sale) => sale.clientId === selectedClient?.id)
    .sort((left, right) => right.saleDate.localeCompare(left.saleDate))
  const clientPayments = payments
    .filter((payment) => payment.clientId === selectedClient?.id)
    .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))

  const clientTimeline = [
    ...clientSales.map((sale) => ({
      id: `sale-${sale.id}`,
      kind: "sale" as const,
      date: sale.saleDate,
      title: `Vente ${sale.id}`,
      subtitle: sale.paymentType ? paymentTypeLabels[sale.paymentType] : "Vente",
      amount: sale.totalAmount,
      balance: sale.remainingAmount,
      note: sale.notes || "",
    })),
    ...clientPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      kind: "payment" as const,
      date: payment.paymentDate,
      title: `Paiement ${payment.id}`,
      subtitle: payment.method ? paymentMethodLabels[payment.method] : "Paiement",
      amount: payment.amount,
      balance: null,
      note: payment.note || payment.reference || "",
    })),
  ].sort((left, right) => right.date.localeCompare(left.date))

  const debtorCount = clientSummaries.filter((entry) => entry.isDebtor).length
  const totalClientExposure = clientSummaries.reduce(
    (sum, entry) => sum + entry.totalRemaining,
    0
  )
  const topClient = clientSummaries[0] ?? null

  function resetForm() {
    setEditingId(null)
    setForm({
      fullName: "",
      phone: "",
      address: "",
      notes: "",
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingId) {
      onUpdate(editingId, form)
    } else {
      onCreate(form)
    }
    resetForm()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="grid gap-6">
        <SectionCard
          title="Synthese clients"
          subtitle="Vue dynamique du portefeuille clients et des encours."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniReportCard label="Clients visibles" value={String(clientSummaries.length)} />
            <MiniReportCard label="Clients debiteurs" value={String(debtorCount)} />
            <MiniReportCard
              label="Encours total"
              value={formatCurrency(totalClientExposure)}
            />
            <MiniReportCard
              label="Top client"
              value={topClient ? topClient.client.fullName : "Aucun"}
            />
          </div>
        </SectionCard>

        <SectionCard
          title={editingId ? "Modifier un client" : "Ajouter un client"}
          subtitle="Recherche par nom ou telephone, fiche detaillee et notes libres."
        >
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Nom complet">
              <input className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required />
            </Field>
            <Field label="Telephone">
              <input className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required />
            </Field>
            <Field label="Adresse">
              <input className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} required />
            </Field>
            <Field label="Notes">
              <textarea className="min-h-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" className="rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-900">{editingId ? "Mettre a jour" : "Ajouter"}</Button>
              <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={resetForm}>Reinitialiser</Button>
            </div>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6">
        <SectionCard title="Base clients" subtitle="Consulter, chercher et ouvrir un historique client.">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="h-11 w-full bg-transparent outline-none" placeholder="Rechercher par nom ou telephone" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            {(["all", "debtors", "clear"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={debtFilter === value ? "default" : "outline"}
                className={`rounded-full px-4 ${
                  debtFilter === value ? "bg-slate-950 text-white" : ""
                }`}
                onClick={() => setDebtFilter(value)}
              >
                {value === "all" && "Tous"}
                {value === "debtors" && "Debiteurs"}
                {value === "clear" && "Sans dette"}
              </Button>
            ))}
          </div>

          <div className="grid gap-3">
            {clientSummaries.length ? clientSummaries.map((entry) => {
              const client = entry.client
              return (
                <button key={client.id} type="button" onClick={() => setSelectedClientId(client.id)} className={`w-full overflow-hidden rounded-[1.5rem] border p-4 text-left transition ${selectedClient?.id === client.id ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-slate-50 hover:border-cyan-300"}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words font-semibold">{client.fullName}</p>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.isDebtor ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {entry.isDebtor ? "Debiteur" : "A jour"}
                        </span>
                      </div>
                      <p className="break-all text-sm text-slate-500">{client.phone}</p>
                      <p className="mt-1 break-words text-sm text-slate-600">{client.address}</p>
                      <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:flex sm:flex-wrap sm:gap-3">
                        <span>{entry.salesCount} vente(s)</span>
                        <span>{entry.paymentsCount} paiement(s)</span>
                        <span>CA {formatCurrency(entry.totalSalesAmount)}</span>
                        <span>Reste {formatCurrency(entry.totalRemaining)}</span>
                      </div>
                    </div>
                    <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                      <Button type="button" size="sm" variant="outline" className="w-full" onClick={(event) => { event.stopPropagation(); setEditingId(client.id); setForm({ fullName: client.fullName, phone: client.phone, address: client.address, notes: client.notes }) }}>Modifier</Button>
                      <Button type="button" size="sm" variant="destructive" className="w-full" onClick={(event) => { event.stopPropagation(); onDelete(client.id) }}>Supprimer</Button>
                    </div>
                  </div>
                </button>
              )
            }) : <EmptyState text="Aucun client ne correspond a la recherche." />}
          </div>
        </SectionCard>

        <SectionCard title="Historique du client" subtitle="Vue synthese des ventes et paiements lies au client selectionne.">
          {selectedClient ? (
            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-lg font-semibold">{selectedClient.fullName}</p>
                <p className="break-all text-sm text-slate-500">{selectedClient.phone}</p>
                <p className="mt-2 break-words text-sm leading-7 text-slate-600">{selectedClient.notes || "Aucune note"}</p>
              </div>

              {selectedSummary ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MiniReportCard label="Ventes" value={String(selectedSummary.salesCount)} />
                  <MiniReportCard label="Paiements" value={String(selectedSummary.paymentsCount)} />
                  <MiniReportCard label="CA client" value={formatCurrency(selectedSummary.totalSalesAmount)} />
                  <MiniReportCard label="Reste a payer" value={formatCurrency(selectedSummary.totalRemaining)} />
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold">Ventes</p>
                  <div className="mt-3 grid gap-3">
                    {clientSales.length ? clientSales.map((sale) => (
                      <div key={sale.id} className="rounded-2xl bg-white p-3">
                        <p className="font-medium">{formatCurrency(sale.totalAmount)}</p>
                        <p className="text-sm text-slate-500">{formatDate(sale.saleDate)}</p>
                        <p className="text-sm text-slate-500">{sale.paymentType ? paymentTypeLabels[sale.paymentType] : "Vente"}</p>
                        <p className="text-sm text-cyan-700">Reste {formatCurrency(sale.remainingAmount)}</p>
                      </div>
                    )) : <EmptyState text="Aucune vente pour ce client." />}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold">Paiements</p>
                  <div className="mt-3 grid gap-3">
                    {clientPayments.length ? clientPayments.map((payment) => (
                      <div key={payment.id} className="rounded-2xl bg-white p-3">
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-slate-500">{formatDate(payment.paymentDate)}</p>
                        <p className="text-sm text-slate-500">{payment.method ? paymentMethodLabels[payment.method] : "Paiement"}</p>
                      </div>
                    )) : <EmptyState text="Aucun paiement enregistre." />}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold">Timeline client</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Activite recente
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {clientTimeline.length ? clientTimeline.map((entry) => (
                    <div key={entry.id} className="rounded-2xl bg-white p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.kind === "sale" ? "bg-cyan-100 text-cyan-800" : "bg-emerald-100 text-emerald-800"}`}>
                              {entry.kind === "sale" ? "Vente" : "Paiement"}
                            </span>
                            <p className="break-words font-semibold">{entry.title}</p>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{formatDate(entry.date)}</p>
                          <p className="break-words text-sm text-slate-600">{entry.subtitle}</p>
                          {entry.note ? <p className="mt-2 break-words text-sm leading-6 text-slate-600">{entry.note}</p> : null}
                        </div>
                        <div className="text-left md:text-right">
                          <p className="font-semibold">{formatCurrency(entry.amount)}</p>
                          {entry.balance !== null ? <p className="text-sm text-rose-700">Reste {formatCurrency(entry.balance)}</p> : null}
                        </div>
                      </div>
                    </div>
                  )) : <EmptyState text="Aucune activite pour ce client." />}
                </div>
              </div>
            </div>
          ) : <EmptyState text="Selectionne un client pour afficher son historique." />}
        </SectionCard>
      </div>
    </div>
  )
}

export function ProductsView({
  products,
  stockMovements,
  onCreate,
  onUpdate,
  onDelete,
}: {
  products: Product[]
  stockMovements: {
    id: string
    productId: string
    productName: string
    movementType: "in" | "out"
    quantity: number
    reason: string
    createdAt: string
  }[]
  onCreate: (payload: Omit<Product, "id" | "createdAt">) => void
  onUpdate: (id: string, payload: Omit<Product, "id" | "createdAt">) => void
  onDelete: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{
    name: string
    description: string
    unitPrice: number
    stockQuantity: number
    status: Product["status"]
  }>({
    name: "",
    description: "",
    unitPrice: 0,
    stockQuantity: 0,
    status: "active",
  })

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.description}`.toLowerCase().includes(search.toLowerCase())
  )

  function resetForm() {
    setEditingId(null)
    setForm({ name: "", description: "", unitPrice: 0, stockQuantity: 0, status: "active" })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingId) {
      onUpdate(editingId, form)
    } else {
      onCreate(form)
    }
    resetForm()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionCard title={editingId ? "Modifier un produit" : "Ajouter un produit"} subtitle="Le stock disponible servira aux controles lors de la vente.">
        <form className="grid gap-4" onSubmit={submit}>
          <Field label="Nom"><input className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></Field>
          <Field label="Description"><textarea className="min-h-24 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Prix unitaire"><input type="number" min="0" className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.unitPrice} onChange={(event) => setForm((current) => ({ ...current, unitPrice: Number(event.target.value) }))} required /></Field>
            <Field label="Quantite en stock"><input type="number" min="0" className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.stockQuantity} onChange={(event) => setForm((current) => ({ ...current, stockQuantity: Number(event.target.value) }))} required /></Field>
          </div>
          <Field label="Statut">
            <select className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Product["status"] }))}>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-900">{editingId ? "Mettre a jour" : "Ajouter"}</Button>
            <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={resetForm}>Reinitialiser</Button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-6">
        <SectionCard title="Catalogue produits" subtitle="Recherche et suivi du stock courant.">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="h-11 w-full bg-transparent outline-none" placeholder="Rechercher un produit" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="grid gap-3">
            {filteredProducts.map((product) => (
              <div key={product.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-sm text-slate-500">{product.description}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      <span>{formatCurrency(product.unitPrice)}</span>
                      <span>Stock {product.stockQuantity}</span>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${product.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{product.status === "active" ? "Actif" : "Inactif"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => { setEditingId(product.id); setForm({ name: product.name, description: product.description, unitPrice: product.unitPrice, stockQuantity: product.stockQuantity, status: product.status }) }}>Modifier</Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(product.id)}>Supprimer</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Mouvements de stock" subtitle="Historique simplifie des entrees et sorties detectees.">
          <div className="grid gap-3">
            {stockMovements.slice(0, 8).map((movement) => (
              <div key={movement.id} className="flex flex-col gap-2 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{movement.productName}</p>
                  <p className="text-sm text-slate-500">{movement.reason}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${movement.movementType === "out" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{movement.movementType === "out" ? "Sortie" : "Entree"}</span>
                  <span className="font-semibold">{movement.quantity}</span>
                  <span className="text-sm text-slate-500">{formatDateTime(movement.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

export function SalesView({
  clients,
  products,
  sales,
  onCreate,
}: {
  clients: Client[]
  products: Product[]
  sales: {
    id: string
    clientName: string
    saleDate: string
    paymentType: PaymentType
    totalAmount: number
    paidAmount: number
    remainingAmount: number
    items: { id: string; productName: string; quantity: number; lineTotal: number }[]
  }[]
  onCreate: (payload: SaleInput) => void
}) {
  const [form, setForm] = useState<SaleInput>({
    clientId: clients[0]?.id ?? "",
    saleDate: todayIsoDate(),
    paymentType: "cash",
    initialPaid: 0,
    notes: "",
    items: [{ productId: products[0]?.id ?? "", quantity: 1 }],
  })

  const computedItems = form.items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    return product ? { product, quantity: item.quantity, lineTotal: product.unitPrice * item.quantity } : null
  }).filter(Boolean)

  const total = computedItems.reduce((sum, entry) => sum + (entry?.lineTotal ?? 0), 0)
  const initialPaid = form.paymentType === "cash" ? total : form.initialPaid
  const remainingAmount = Math.max(total - initialPaid, 0)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onCreate({ ...form, initialPaid, items: form.items.filter((item) => item.productId && item.quantity > 0) })
    setForm({
      clientId: clients[0]?.id ?? "",
      saleDate: todayIsoDate(),
      paymentType: "cash",
      initialPaid: 0,
      notes: "",
      items: [{ productId: products[0]?.id ?? "", quantity: 1 }],
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <SectionCard title="Nouvelle vente" subtitle="Le stock diminue a la validation et une dette est creee si la vente n'est pas totalement payee.">
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Client">
              <select className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.clientId} onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.fullName}</option>)}
              </select>
            </Field>
            <Field label="Date de vente"><input type="date" className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.saleDate} onChange={(event) => setForm((current) => ({ ...current, saleDate: event.target.value }))} /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type de paiement">
              <select className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.paymentType} onChange={(event) => setForm((current) => ({ ...current, paymentType: event.target.value as PaymentType }))}>
                <option value="cash">Comptant</option>
                <option value="credit">Credit</option>
                <option value="deposit">Acompte</option>
              </select>
            </Field>
            <Field label="Paiement initial"><input type="number" min="0" disabled={form.paymentType === "cash"} className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500 disabled:opacity-50" value={form.paymentType === "cash" ? total : form.initialPaid} onChange={(event) => setForm((current) => ({ ...current, initialPaid: Number(event.target.value) }))} /></Field>
          </div>

          <Field label="Notes"><textarea className="min-h-24 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field>

          <div className="grid gap-3">
            {form.items.map((item, index) => (
              <div key={`${item.productId}-${index}`} className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.3fr_0.7fr_auto]">
                <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-cyan-500" value={item.productId} onChange={(event) => setForm((current) => ({ ...current, items: current.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, productId: event.target.value } : entry) }))}>
                  {products.filter((product) => product.status === "active").map((product) => <option key={product.id} value={product.id}>{product.name} - {formatCurrency(product.unitPrice)} - stock {product.stockQuantity}</option>)}
                </select>
                <input type="number" min="1" className="h-11 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-cyan-500" value={item.quantity} onChange={(event) => setForm((current) => ({ ...current, items: current.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: Number(event.target.value) } : entry) }))} />
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setForm((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((_, entryIndex) => entryIndex !== index) }))}>Retirer</Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" className="w-fit rounded-2xl" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { productId: products[0]?.id ?? "", quantity: 1 }] }))}>Ajouter une ligne</Button>

          <div className="grid gap-3 rounded-[1.5rem] bg-slate-950 p-5 text-white md:grid-cols-3">
            <div><p className="text-sm text-slate-300">Total</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(total)}</p></div>
            <div><p className="text-sm text-slate-300">Paye</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(initialPaid)}</p></div>
            <div><p className="text-sm text-slate-300">Reste a payer</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(remainingAmount)}</p></div>
          </div>

          <Button type="submit" className="h-11 rounded-2xl bg-cyan-600 px-5 text-white hover:bg-cyan-700">Valider la vente</Button>
        </form>
      </SectionCard>

      <SectionCard title="Historique des ventes" subtitle="Liste recente des ventes validees.">
        <div className="grid gap-3">
          {sales.slice(0, 8).map((sale) => (
            <div key={sale.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">{sale.clientName}</p>
                  <p className="text-sm text-slate-500">{formatDate(sale.saleDate)}</p>
                  <p className="mt-1 text-sm text-cyan-700">{paymentTypeLabels[sale.paymentType]}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(sale.totalAmount)}</p>
                  <p className="text-sm text-slate-500">Paye {formatCurrency(sale.paidAmount)}</p>
                  <p className="text-sm text-rose-700">Reste {formatCurrency(sale.remainingAmount)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sale.items.map((item) => <span key={item.id} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">{item.productName} x {item.quantity}</span>)}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

export function DebtsView({
  debts,
  sales,
}: {
  debts: Debt[]
  sales: { id: string; notes: string; items: { id: string; productName: string; quantity: number }[] }[]
}) {
  const [status, setStatus] = useState<DebtStatus | "all">("all")
  const filteredDebts = status === "all" ? debts : debts.filter((debt) => debt.status === status)

  return (
    <div className="grid gap-6">
      <SectionCard title="Dettes clients" subtitle="Chaque dette est issue d'une vente non totalement payee.">
        <div className="mb-4 flex flex-wrap gap-3">
          {(["all", "unpaid", "partial", "paid"] as const).map((value) => (
            <Button key={value} type="button" variant={status === value ? "default" : "outline"} className={`rounded-full px-4 ${status === value ? "bg-slate-950 text-white" : ""}`} onClick={() => setStatus(value)}>
              {value === "all" ? "Toutes" : debtLabels[value]}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {filteredDebts.length ? filteredDebts.map((debt) => {
            const sale = sales.find((entry) => entry.id === debt.saleId)
            return (
              <article key={debt.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{debt.clientName}</p>
                    <p className="text-sm text-slate-500">Echeance {formatDate(debt.dueDate)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(debt.status)}`}>{debtLabels[debt.status]}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <MiniMetric label="Dette initiale" value={formatCurrency(debt.initialAmount)} />
                  <MiniMetric label="Total paye" value={formatCurrency(debt.totalPaid)} />
                  <MiniMetric label="Reste" value={formatCurrency(debt.remainingAmount)} />
                </div>
                <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">Lignes de vente</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sale?.items.map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{item.productName} x {item.quantity}</span>) ?? <EmptyState text="Aucune ligne de vente chargee." />}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{sale?.notes || "Aucune note liee a cette vente."}</p>
                </div>
              </article>
            )
          }) : <EmptyState text="Aucune dette correspondant au filtre." />}
        </div>
      </SectionCard>
    </div>
  )
}

export function PaymentsView({
  debts,
  payments,
  onCreate,
}: {
  debts: Debt[]
  payments: {
    id: string
    debtId: string
    clientName: string
    paymentDate: string
    amount: number
    method: PaymentMethod
    reference: string
    note: string
  }[]
  onCreate: (payload: PaymentInput) => void
}) {
  const openDebts = debts.filter((debt) => debt.status !== "paid")
  const [form, setForm] = useState<PaymentInput>({
    debtId: openDebts[0]?.id ?? "",
    paymentDate: todayIsoDate(),
    amount: 0,
    method: "cash",
    reference: "",
    note: "",
  })
  const selectedDebt = debts.find((debt) => debt.id === form.debtId) ?? null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onCreate(form)
    setForm({ debtId: openDebts[0]?.id ?? "", paymentDate: todayIsoDate(), amount: 0, method: "cash", reference: "", note: "" })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <SectionCard title="Enregistrer un paiement" subtitle="Le montant verse ne peut pas depasser le solde restant.">
        {openDebts.length ? (
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Dette">
              <select className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.debtId} onChange={(event) => setForm((current) => ({ ...current, debtId: event.target.value }))}>
                {openDebts.map((debt) => <option key={debt.id} value={debt.id}>{debt.clientName} - reste {formatCurrency(debt.remainingAmount)}</option>)}
              </select>
            </Field>
            {selectedDebt ? (
              <div className="grid gap-3 rounded-[1.5rem] bg-slate-950 p-5 text-white md:grid-cols-3">
                <MiniMetric dark label="Dette initiale" value={formatCurrency(selectedDebt.initialAmount)} />
                <MiniMetric dark label="Total paye" value={formatCurrency(selectedDebt.totalPaid)} />
                <MiniMetric dark label="Reste" value={formatCurrency(selectedDebt.remainingAmount)} />
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Date"><input type="date" className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.paymentDate} onChange={(event) => setForm((current) => ({ ...current, paymentDate: event.target.value }))} /></Field>
              <Field label="Montant"><input type="number" min="0" max={selectedDebt?.remainingAmount ?? undefined} className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: Number(event.target.value) }))} /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Methode">
                <select className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value as PaymentMethod }))}>
                  <option value="cash">Especes</option>
                  <option value="mobile_money">Mobile money</option>
                  <option value="bank">Banque</option>
                  <option value="card">Carte</option>
                </select>
              </Field>
              <Field label="Reference"><input className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-cyan-500" value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></Field>
            </div>
            <Field label="Note"><textarea className="min-h-24 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></Field>
            <Button type="submit" className="h-11 rounded-2xl bg-cyan-600 text-white hover:bg-cyan-700">Enregistrer le paiement</Button>
          </form>
        ) : <EmptyState text="Toutes les dettes sont deja soldees." />}
      </SectionCard>

      <SectionCard title="Historique des paiements" subtitle="Liste complete des versements saisis sur les dettes clientes.">
        <div className="grid gap-3">
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">{payment.clientName}</p>
                  <p className="text-sm text-slate-500">{formatDate(payment.paymentDate)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                  <p className="text-sm text-cyan-700">{paymentMethodLabels[payment.method]}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">Ref: {payment.reference || "Aucune reference"}</p>
              <p className="mt-1 text-sm leading-7 text-slate-600">{payment.note || "Aucune note"}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

export function ReportsView({
  clients,
  products,
  sales,
  debts,
  payments,
}: {
  clients: Client[]
  products: Product[]
  sales: { id: string; saleDate: string; paymentType: PaymentType; totalAmount: number; remainingAmount: number; items: { productId: string; quantity: number }[] }[]
  debts: Debt[]
  payments: { paymentDate: string; amount: number }[]
}) {
  const [range, setRange] = useState<"today" | "week" | "month" | "all">("all")
  const now = new Date()
  const today = startOfDay(now)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - 7)
  const monthStart = new Date(today)
  monthStart.setMonth(today.getMonth() - 1)

  function withinRange(value: string) {
    if (range === "all") return true
    const date = startOfDay(new Date(value))
    if (range === "today") return date.getTime() === today.getTime()
    if (range === "week") return date >= weekStart
    return date >= monthStart
  }

  const salesInRange = sales.filter((sale) => withinRange(sale.saleDate))
  const paymentsInRange = payments.filter((payment) => withinRange(payment.paymentDate))
  const totalSales = salesInRange.reduce((sum, sale) => sum + sale.totalAmount, 0)
  const totalCreditSales = salesInRange.filter((sale) => sale.paymentType !== "cash").reduce((sum, sale) => sum + sale.totalAmount, 0)
  const totalRecovered = paymentsInRange.reduce((sum, payment) => sum + payment.amount, 0)
  const totalOutstanding = debts.reduce((sum, debt) => sum + debt.remainingAmount, 0)

  const productCounts: Record<string, number> = {}
  salesInRange.forEach((sale) => {
    sale.items.forEach((item) => {
      productCounts[item.productId] = (productCounts[item.productId] ?? 0) + item.quantity
    })
  })

  const topProducts = Object.entries(productCounts).map(([productId, quantity]) => ({
    name: products.find((product) => product.id === productId)?.name ?? productId,
    quantity,
  })).sort((left, right) => right.quantity - left.quantity).slice(0, 5)

  const debtByClient = clients.map((client) => ({
    clientName: client.fullName,
    remainingAmount: debts.filter((debt) => debt.clientId === client.id).reduce((sum, debt) => sum + debt.remainingAmount, 0),
  })).filter((entry) => entry.remainingAmount > 0).sort((left, right) => right.remainingAmount - left.remainingAmount).slice(0, 5)

  return (
    <div className="grid gap-6">
      <SectionCard title="Synthese des rapports" subtitle="Filtres simples pour le journalier, hebdomadaire, mensuel ou global.">
        <div className="mb-4 flex flex-wrap gap-3">
          {(["today", "week", "month", "all"] as const).map((value) => (
            <Button key={value} type="button" variant={range === value ? "default" : "outline"} className={`rounded-full px-4 ${range === value ? "bg-slate-950 text-white" : ""}`} onClick={() => setRange(value)}>
              {value === "today" && "Journalier"}
              {value === "week" && "Hebdomadaire"}
              {value === "month" && "Mensuel"}
              {value === "all" && "Global"}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniReportCard label="Total des ventes" value={formatCurrency(totalSales)} />
          <MiniReportCard label="Ventes a credit" value={formatCurrency(totalCreditSales)} />
          <MiniReportCard label="Total rembourse" value={formatCurrency(totalRecovered)} />
          <MiniReportCard label="Reste a recouvrer" value={formatCurrency(totalOutstanding)} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="rounded-2xl bg-cyan-600 px-5 text-white hover:bg-cyan-700" onClick={() => exportCsv("rapport-marcher-vente.csv", [["Indicateur", "Valeur"], ["Periode", range], ["Total des ventes", String(totalSales)], ["Ventes a credit", String(totalCreditSales)], ["Total rembourse", String(totalRecovered)], ["Reste a recouvrer", String(totalOutstanding)]])}>Export CSV</Button>
          <Button variant="outline" className="rounded-2xl px-5">Export PDF</Button>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Produits les plus vendus">
          <div className="grid gap-3">
            {topProducts.length ? topProducts.map((product) => (
              <div key={product.name} className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <span className="font-medium">{product.name}</span>
                <span className="text-cyan-700">{product.quantity} unites</span>
              </div>
            )) : <EmptyState text="Pas assez de ventes sur cette periode." />}
          </div>
        </SectionCard>

        <SectionCard title="Clients a recouvrer en priorite">
          <div className="grid gap-3">
            {debtByClient.length ? debtByClient.map((entry) => (
              <div key={entry.clientName} className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <span className="font-medium">{entry.clientName}</span>
                <span className="text-rose-700">{formatCurrency(entry.remainingAmount)}</span>
              </div>
            )) : <EmptyState text="Aucun encours a afficher." />}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
