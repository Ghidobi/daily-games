import { useState } from 'react'
import type { DragEvent } from 'react'

/** Sposta l'elemento `from` nella posizione di `to`. */
export function moveItem<T>(list: T[], from: T, to: T): T[] {
  const without = list.filter((x) => x !== from)
  const at = without.indexOf(to)
  const fromIdx = list.indexOf(from)
  const toIdx = list.indexOf(to)
  // Trascinando verso il basso si inserisce dopo il bersaglio, verso l'alto prima.
  without.splice(fromIdx < toIdx ? at + 1 : at, 0, from)
  return without
}

/**
 * Riordino con il trascinamento (drag & drop HTML5) per liste di id.
 * `itemProps(id)` va steso sull'elemento trascinabile.
 */
export function useDragReorder(ids: string[], onReorder: (ids: string[]) => void) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const itemProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDragging(id)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
    },
    onDragOver: (e: DragEvent) => {
      if (!dragging) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (over !== id) setOver(id)
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      if (dragging && dragging !== id) onReorder(moveItem(ids, dragging, id))
      setDragging(null)
      setOver(null)
    },
    onDragEnd: () => {
      setDragging(null)
      setOver(null)
    },
    'data-dragging': dragging === id || undefined,
    'data-over': (over === id && dragging !== id) || undefined
  })

  return { itemProps, dragging }
}

/** Nuovo ordine completo quando si riordinano solo i giochi visibili: i nascosti restano in coda. */
export function withHidden(allIds: string[], visibleOrder: string[]): string[] {
  return [...visibleOrder, ...allIds.filter((id) => !visibleOrder.includes(id))]
}
