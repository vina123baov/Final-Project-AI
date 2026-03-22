'use client'

import { AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  message: string
  type: ToastType
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  const styles = {
    success: 'bg-success/10 border-success/30 text-success',
    error: 'bg-destructive/10 border-destructive/30 text-destructive',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    info: 'bg-primary/10 border-primary/30 text-primary',
  }

  const icons = {
    success: <CheckCircle size={20} />,
    error: <AlertCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <AlertCircle size={20} />,
  }

  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border ${styles[type]} animate-in fade-in slide-in-from-top-5`}>
      <div>{icons[type]}</div>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button onClick={onClose} className="hover:opacity-70">
        <X size={18} />
      </button>
    </div>
  )
}
