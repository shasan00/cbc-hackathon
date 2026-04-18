"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
}

export function Toast({ message, visible, onHide }: ToastProps) {
  React.useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  return (
    <div
      className={cn(
        "fixed bottom-8 left-1/2 z-50 -translate-x-1/2 transform transition-all duration-300",
        "rounded-full border border-[#34d399] bg-[#151929] px-6 py-3 text-sm font-bold text-[#e8eaf0] shadow-xl whitespace-nowrap",
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"
      )}
    >
      {message}
    </div>
  );
}

// ---- useToast hook ----
export function useToast() {
  const [toastState, setToastState] = React.useState<{
    message: string;
    visible: boolean;
  }>({ message: "", visible: false });

  const showToast = React.useCallback((message: string) => {
    setToastState({ message, visible: true });
  }, []);

  const hideToast = React.useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  return { toastState, showToast, hideToast };
}
