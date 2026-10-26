// Icone di interfaccia disegnate a mano (tratto 2px, 24×24).
const PATHS = {
  today: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  back: 'M15 18l-6-6 6-6',
  reload: 'M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6',
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  system: 'M4 5h16v11H4zM9 20h6M12 16v4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  sidebar: 'M4 4h16v16H4zM9 4v16',
  flame: 'M12 22c4 0 7-2.7 7-6.8 0-3.6-2.4-6-4.3-8.2-.4 2-1.4 3.3-2.7 4 0-3.3-1.3-6.3-4-9 .2 3.3-1.4 5.3-2.9 7.1C3.9 10.6 5 13 5 15.2 5 19.3 8 22 12 22z',
  clipboard: 'M9 4h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 13h6M9 17h4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M7 8l5-5 5 5',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6'
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
