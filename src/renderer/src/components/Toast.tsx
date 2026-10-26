import { useEffect } from 'react'
import type { Toast as ToastData } from '@shared/types'
import { Icon } from './Icon'

/** Avviso breve (es. "Risultato salvato") che sparisce da solo dopo qualche secondo. */
export function Toast({ toast, inline = false }: { toast: ToastData; inline?: boolean }) {
  useEffect(() => {
    const t = setTimeout(() => window.api.dismissToast(toast.id), toast.undo ? 7000 : 4000)
    return () => clearTimeout(t)
  }, [toast.id, toast.undo])

  return (
    <div key={toast.id} className={`toast${inline ? ' inline' : ''}`} role="status">
      <span className="toast-check"><Icon name="check" size={13} /></span>
      <span className="toast-text">{toast.text}</span>
      {toast.undo && (
        <button className="toast-undo" onClick={() => window.api.undoResult()}>
          Annulla
        </button>
      )}
      <button className="toast-close" onClick={() => window.api.dismissToast(toast.id)} title="Chiudi">
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}
