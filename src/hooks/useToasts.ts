import { useCallback, useState } from "react";
import type { Toast } from "../types";

let nextToastId = 1;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((type: Toast["type"], message: string) => {
    const id = nextToastId++;
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  return { toasts, pushToast };
}
