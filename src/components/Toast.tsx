"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Système de toast global — pattern Sonner/react-hot-toast.
 *
 * 4 variants : success / error / info / warning.
 * Auto-dismiss après 4s par défaut, stack si plusieurs.
 * Sticky top-right desktop, top-center mobile (sous la nav).
 *
 * Usage :
 *   const toast = useToast();
 *   toast.success("Profil enregistré");
 *   toast.error("Échec : reconnecte-toi");
 */

export type ToastVariant = "success" | "error" | "info" | "warning";

type Toast = {
  id: number;
  variant: ToastVariant;
  message: string;
};

type ToastContextValue = {
  push: (variant: ToastVariant, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId++;
      setToasts((cur) => [...cur, { id, variant, message }]);
      // Auto-dismiss après 4s.
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const value: ToastContextValue = {
    push,
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
    warning: (m) => push("warning", m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Pas de provider : on log mais on ne crash pas. Permet d'appeler
    // useToast() depuis un composant rendu hors du provider sans tout casser.
    return {
      push: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
    };
  }
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    icon: "✓",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    icon: "✕",
  },
  info: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-900",
    icon: "ℹ",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    icon: "⚠",
  },
};

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:top-6 sm:items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Slide-in à l'apparition.
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const s = VARIANT_STYLES[toast.variant];

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border ${s.border} ${s.bg} px-4 py-3 shadow-lg backdrop-blur transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
      role="status"
    >
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.text}`}>
        {s.icon}
      </span>
      <p className={`flex-1 text-sm font-medium ${s.text}`}>{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fermer"
        className={`text-base font-bold ${s.text} opacity-50 transition hover:opacity-100`}
      >
        ×
      </button>
    </div>
  );
}
