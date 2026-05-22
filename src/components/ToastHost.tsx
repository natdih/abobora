import type { Toast } from "../types";
import { cn } from "../utils/format";

export function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed right-3 top-3 z-50 flex w-[min(420px,calc(100vw-1.5rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "rounded-md border px-4 py-3 text-sm font-semibold shadow-soft",
            toast.type === "success" && "border-green-300 bg-green-50 text-green-900",
            toast.type === "error" && "border-red-300 bg-red-50 text-red-900",
            toast.type === "info" && "border-amber-300 bg-amber-50 text-amber-900"
          )}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
