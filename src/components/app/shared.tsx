import type { ReactNode } from "react"
import type { LayoutDashboard } from "lucide-react"

export function FeatureCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof LayoutDashboard
  title: string
  text: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{text}</p>
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

export function DemoAccount({
  role,
  email,
  password,
  onPick,
}: {
  role: string
  email: string
  password: string
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-500 hover:bg-cyan-50"
    >
      <p className="font-semibold text-slate-900">{role}</p>
      <p className="mt-1 text-sm text-slate-600">{email}</p>
      <p className="text-sm text-slate-500">{password}</p>
    </button>
  )
}

export function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[2rem] border border-white bg-white/85 p-6 shadow-[0_25px_60px_-50px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="mt-2 text-sm leading-7 text-slate-600">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function MiniMetric({
  label,
  value,
  dark = false,
}: {
  label: string
  value: string
  dark?: boolean
}) {
  return (
    <div className={`rounded-[1.25rem] p-4 ${dark ? "bg-white/8" : "bg-slate-100"}`}>
      <p className={`text-sm ${dark ? "text-slate-300" : "text-slate-500"}`}>{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

export function MiniReportCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
      {text}
    </div>
  )
}
