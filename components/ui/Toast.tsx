// ============================================================
// Toast — lightweight, dependency-free notification system.
//
// Wrap the app in <ToastProvider> (done in app/providers.tsx),
// then call useToast() anywhere:
//
//   const toast = useToast();
//   toast.success("Spot approved");
//   toast.error("Couldn't load spots");
//
// Toasts auto-dismiss after a few seconds and stack in the
// bottom-right (bottom-center on mobile).
// ============================================================

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-success/30 bg-success/15 text-success",
  error: "border-danger/30 bg-danger/15 text-danger",
  info: "border-line bg-elevated text-ink",
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => remove(id), AUTO_DISMISS_MS);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m: string) => push(m, "success"),
      error: (m: string) => push(m, "error"),
      info: (m: string) => push(m, "info"),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast stack — fixed above all app UI */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[10000] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => remove(t.id)}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium shadow-2xl backdrop-blur-sm transition-all sm:w-auto ${VARIANT_STYLES[t.variant]}`}
          >
            <span aria-hidden="true" className="mt-px shrink-0">
              {VARIANT_ICON[t.variant]}
            </span>
            <span className="min-w-0 flex-1 break-words">{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
