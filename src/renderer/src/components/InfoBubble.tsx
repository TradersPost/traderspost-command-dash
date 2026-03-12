import { useState, useRef, useEffect } from 'react'

interface InfoBubbleProps {
  text: string
}

export function InfoBubble({ text }: InfoBubbleProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-4 w-4 items-center justify-center rounded-full text-text-dim hover:text-text-secondary hover:bg-bg-elevated transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0ZM7 7h1.25v4.25H7V7Z" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-5 top-0 z-50 w-56 rounded-lg bg-bg-card border border-border p-3 shadow-lg shadow-black/40">
          <p className="text-[11px] leading-relaxed text-text-secondary">{text}</p>
        </div>
      )}
    </div>
  )
}
