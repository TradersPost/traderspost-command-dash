import { InfoBubble } from './InfoBubble'

export function TitleBar() {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* TradersPost arrow icon */}
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
        <span className="text-[10px] font-medium text-accent tracking-wide uppercase" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>GEX</span>
        <InfoBubble text="Gamma Exposure (GEX) measures the hedging pressure market makers face from their options positions. When GEX is high, dealers must buy dips and sell rallies, suppressing volatility. When GEX is negative, their hedging amplifies moves, increasing volatility. This tool calculates real-time GEX from the full SPX option chain." />
      </div>
      <div className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => window.api.minimizeWindow()}
          className="flex h-6 w-6 items-center justify-center rounded text-text-dim hover:bg-bg-elevated hover:text-text-secondary"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={() => window.api.closeWindow()}
          className="flex h-6 w-6 items-center justify-center rounded text-text-dim hover:bg-red-500/20 hover:text-red-400"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
