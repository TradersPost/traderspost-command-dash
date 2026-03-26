import { useState, useRef, useEffect } from 'react'
import { InfoBubble } from './InfoBubble'

interface PolymarketTitleBarProps {
  slug: string
  onChangeSlug: (slug: string) => void
  onOpenSettings: () => void
}

function extractSlug(input: string): string {
  const trimmed = input.trim()
  // Full URL: https://polymarket.com/event/what-will-ndx-hit-in-march-2026
  const urlMatch = trimmed.match(/polymarket\.com\/event\/([a-z0-9-]+)/)
  if (urlMatch) return urlMatch[1]!
  // Already a slug
  return trimmed
}

export function PolymarketTitleBar({ slug, onChangeSlug, onOpenSettings }: PolymarketTitleBarProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleOpen = () => {
    setInputValue(slug)
    setEditing(true)
  }

  const handleSubmit = () => {
    const newSlug = extractSlug(inputValue)
    if (newSlug && newSlug !== slug) {
      onChangeSlug(newSlug)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div>
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <rect width="24" height="24" rx="5" fill="#2e90fa" />
            <path
              d="M7 12h10M13 8l4 4-4 4"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[13px] font-semibold text-text-primary tracking-tight" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            TradersPost
          </span>
          <span className="text-[10px] font-medium text-accent tracking-wide uppercase" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>POLY</span>
          <InfoBubble text="Polymarket is a prediction market where traders buy and sell outcome shares priced 0–100¢. The price reflects the crowd's estimated probability of that outcome occurring. This widget shows real-time probabilities for each outcome in the selected market, refreshing every 30 seconds." />
          {/* Edit market button */}
          <button
            onClick={handleOpen}
            className="flex h-5 w-5 items-center justify-center rounded text-text-dim hover:bg-bg-elevated hover:text-text-secondary"
            title="Change market"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.15 1.85a1.5 1.5 0 0 1 2.12 2.12L5.7 12.54l-3.08.77.77-3.08 8.76-8.38ZM11 3l2 2" />
            </svg>
          </button>
        </div>
        <div className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={onOpenSettings}
            className="flex h-6 w-6 items-center justify-center rounded text-text-dim hover:bg-bg-elevated hover:text-text-secondary"
            title="Webhook settings"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.5.5a1 1 0 0 1 3 0v1.21a5.5 5.5 0 0 1 1.6.66l.86-.86a1 1 0 1 1 1.41 1.41l-.86.86c.3.49.52 1.02.66 1.6H14.5a1 1 0 1 1 0 3h-1.21a5.5 5.5 0 0 1-.66 1.6l.86.86a1 1 0 1 1-1.41 1.41l-.86-.86a5.5 5.5 0 0 1-1.6.66v1.33a1 1 0 1 1-3 0v-1.21a5.5 5.5 0 0 1-1.6-.66l-.86.86a1 1 0 0 1-1.41-1.41l.86-.86A5.5 5.5 0 0 1 2.83 9.5H1.5a1 1 0 0 1 0-3h1.21a5.5 5.5 0 0 1 .66-1.6l-.86-.86A1 1 0 0 1 3.93 2.6l.86.86A5.5 5.5 0 0 1 6.5 2.83V.5ZM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
            </svg>
          </button>
          <button
            onClick={() => window.api.minimizePolymarketWindow()}
            className="flex h-6 w-6 items-center justify-center rounded text-text-dim hover:bg-bg-elevated hover:text-text-secondary"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
              <rect width="10" height="1" />
            </svg>
          </button>
          <button
            onClick={() => window.api.closePolymarketWindow()}
            className="flex h-6 w-6 items-center justify-center rounded text-text-dim hover:bg-red-500/20 hover:text-red-400"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Inline URL input */}
      {editing && (
        <div className="px-4 pb-2">
          <div className="flex gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSubmit}
              placeholder="Paste Polymarket URL or slug"
              className="flex-1 rounded bg-bg-elevated border border-border px-2 py-1 text-[11px] text-text-primary placeholder:text-text-dim font-mono outline-none focus:border-accent"
            />
          </div>
        </div>
      )}
    </div>
  )
}
