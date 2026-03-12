# TradersPost Command Dash — GEX Widget

A self-contained Electron desktop widget that calculates and displays **SPX Gamma Exposure (GEX)** in real time. It pulls the full SPX option chain from the Massive.com API, runs Black-Scholes calculations locally, and renders an always-on-top floating HUD you can keep on screen while trading.

## What it does

- **Calculates GEX from scratch** — fetches ~12,000+ SPX option contracts, computes gamma exposure per strike using Black-Scholes, and aggregates into a strike profile
- **Horizontal bar chart** — blue bars (call gamma, right) and gray bars (put gamma, left) at each strike, with dashed lines for SPX price, Call Wall, and Put Wall
- **Historical scrubbing** — scrub through 15-minute intraday snapshots with a timeline slider; navigate between trading days with arrow buttons
- **Day range indicators** — faint lines behind each bar show the high/low GEX range observed throughout the session
- **Local disk cache** — computed snapshots are saved to `~/Library/Application Support/command-dash/gex-cache/` so previously loaded days are instant on future launches
- **Rate limit resilience** — exponential backoff retry on 429 responses, throttled pagination to stay within API limits

## Screenshot

The widget runs as a frameless, always-on-top, draggable window (420x680) with TradersPost dark navy branding.

## Setup

### Prerequisites

- Node.js 18+
- A [Massive.com](https://massive.com) (Polygon.io) API key with options data access

### Install

```bash
npm install
```

### Configure

Create a `.env` file in the project root:

```
MASSIVE_API_KEY=your_api_key_here
```

See `.env.example` for reference.

### Development

```bash
npm run dev
```

### Build

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## Architecture

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # Window creation, IPC handlers, disk cache
│   ├── api.ts               # Massive.com API client (pagination, retry, caching)
│   ├── gex-calc.ts          # GEX aggregation, key levels, gamma profile
│   └── black-scholes.ts     # Pure math: normalPdf, normalCdf, bsGamma, bsDelta
├── preload/
│   ├── index.ts             # Context bridge (fetchGex, fetchGexHistory, etc.)
│   └── index.d.ts           # Type declarations
└── renderer/src/
    ├── App.tsx               # Root layout
    ├── app.css               # Tailwind v4 + TradersPost dark theme
    ├── types/gex.ts          # Shared interfaces
    ├── hooks/
    │   └── useGexData.ts     # Data management, day navigation, strike ranges
    └── components/
        ├── TitleBar.tsx       # Draggable header with branding
        ├── GexChart.tsx       # SVG bar chart with level lines
        ├── KeyMetrics.tsx     # Call Wall / Put Wall readout
        ├── ProgressBar.tsx    # Timeline scrubber + day navigation
        └── InfoBubble.tsx     # Contextual info popovers
```

### Data flow

1. **Main process** fetches SPX option snapshots from Massive.com (paginated, cached 60 min)
2. **`gex-calc.ts`** computes `GEX = gamma * OI * shares * spot^2 * 0.01` per contract, aggregates by strike (rounded to $25), derives Call Wall and Put Wall
3. **IPC bridge** sends `GammaNotionalData` to the renderer
4. **`useGexData` hook** manages snapshots per day in a `Map`, computes strike ranges across snapshots, handles day navigation
5. **Components** render the SVG chart, key levels, and timeline scrubber

### Key calculations

- **GEX per contract**: `gamma * openInterest * sharesPerContract * spot^2 * 0.01`
- **Dealer model**: calls = positive gamma (dealers sell rallies), puts = negative gamma (dealers buy dips)
- **Call Wall**: strike with highest call GEX above spot price
- **Put Wall**: strike with most negative put GEX below spot price
- **Gamma profile**: 60 price levels across +/-8% from spot, recalculated via Black-Scholes
- **Historical snapshots**: 15-min SPY bars converted to SPX (`close * 10`), GEX recalculated at each price point

## Tech stack

- **Electron** via `electron-vite`
- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Pure SVG** chart (no charting library)
- **axios** for HTTP
- Zero runtime dependencies beyond axios and dotenv

## License

Private — TradersPost internal tool.
