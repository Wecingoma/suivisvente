import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ToastItem {
  id: string
  type: "success" | "error"
  title: string
  message: string
}

function ToastViewport({
  toasts,
  onClose,
}: {
  toasts: ToastItem[]
  onClose: (id: string) => void
}) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 grid w-[min(24rem,calc(100vw-2rem))] gap-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => onClose(toast.id)} />
      ))}
    </div>
  )
}

function Toast({
  toast,
  onClose,
}: {
  toast: ToastItem
  onClose: () => void
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto rounded-[1.5rem] border px-4 py-4 shadow-[0_25px_60px_-40px_rgba(15,23,42,0.55)] backdrop-blur",
        toast.type === "success"
          ? "border-emerald-200 bg-emerald-50/95 text-emerald-950"
          : "border-rose-200 bg-rose-50/95 text-rose-950"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{toast.title}</p>
          <p className="mt-1 text-sm leading-6">{toast.message}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="rounded-full text-current opacity-70 hover:bg-black/5 hover:text-current hover:opacity-100"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Fermer</span>
        </Button>
      </div>
    </div>
  )
}

export { ToastViewport }
