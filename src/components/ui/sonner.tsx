"use client"

import { CheckCircle, Info, SpinnerGap, WarningCircle, XCircle } from "@phosphor-icons/react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {


  return (
    <Sonner
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          actionButton: "!rounded-sm !bg-ink !text-[13px] !font-medium !text-ground",
        },
      }}
      icons={{
        success: <CheckCircle className="size-5 text-ok" />,
        info: <Info className="size-5" />,
        warning: <WarningCircle className="size-5 text-ahead" />,
        error: <XCircle className="size-5 text-over" />,
        loading: <SpinnerGap className="size-5 animate-spin" />,
      }}
      style={
        {
          // Toasts are a panel: white, one hairline.
          "--normal-bg": "var(--board)",
          "--normal-text": "var(--on-board)",
          "--normal-border": "var(--board-line)",
          "--success-bg": "var(--board)",
          "--success-text": "var(--on-board)",
          "--success-border": "var(--board-line)",
          "--error-bg": "var(--board)",
          "--error-text": "var(--over-text)",
          "--error-border": "var(--over)",
          "--border-radius": "6px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
