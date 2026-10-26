// La "giornata" dell'app segue sempre il fuso Europe/Rome, qualunque sia l'ora del PC.

const ROME_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

/** Restituisce la data di oggi a Roma nel formato YYYY-MM-DD. */
export function romeDayKey(date = new Date()): string {
  return ROME_DATE.format(date)
}

/**
 * Chiama `onChange` quando cambia il giorno a Roma. Un controllo ogni 30 secondi
 * regge anche alla sospensione del PC (al risveglio il primo controllo se ne accorge).
 */
export function watchDayChange(onChange: (dayKey: string) => void): () => void {
  let current = romeDayKey()
  const timer = setInterval(() => {
    const now = romeDayKey()
    if (now !== current) {
      current = now
      onChange(now)
    }
  }, 30_000)
  return () => clearInterval(timer)
}

const ROME_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

/** Ora attuale a Roma nel formato HH:MM. */
export function romeTime(date = new Date()): string {
  return ROME_TIME.format(date)
}
