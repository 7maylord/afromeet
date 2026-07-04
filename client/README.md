# AfroMeet Frontend

The web app for **AfroMeet** — where Africa's underground gets pressed onchain. Creators mint work as NFTs, get paid per play/read/view in USDC on Arc, fractionalise ownership, and govern via fan DAOs. Built with **Next.js 16**, **Privy** (wallet auth), **ethers v6**, and **Tailwind v4**.

> ⚠️ This is Next.js **16** — APIs and conventions differ from older versions. See [AGENTS.md](AGENTS.md); read the relevant guide in `node_modules/next/dist/docs/` before changing framework-level code.

## Design language — "underground dubplate"

A liquid-glass system layered over a boomerang video hero. **Volt blue** (`#2563EB`) is the machine/agent/chrome layer; **ember** (`#E0965A`) marks money (USDC, earnings). Helvetica for headlines/body, **Space Mono** for the on-chain ledger (codes, tx hashes, rates, logs). Design tokens live in [app/globals.css](app/globals.css).

## Meet Euterpe

The landing page and workspace surface **Euterpe**, AfroMeet's autonomous **Patron Agent** (named for the muse of music). The hero's bottom-right **"ON AIR" console** is her live transmitter — Arc's block height reads as a broadcast frequency, her latest pick scrolls past like a station ID, all polled live from the backend (`/health`, `/agent/status`, `/agent/picks`). Her console and picks feed live under the **Euterpe** tab in the workspace.

## Getting started

```bash
pnpm install
cp .env.example .env   # fill NEXT_PUBLIC_* addresses + Privy app id (see .env)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Needs the [backend](../backend/README.md) running (default `http://localhost:3000` via `NEXT_PUBLIC_BACKEND_URL`) for live agent status, catalogue, earnings, and DAO data — panels fall back to seeded data when it's offline.

## Structure

```
app/
├── page.tsx          Landing — hero + Catalogue / Creators / Euterpe / Manifesto
├── app/page.tsx      Authenticated workspace (tabbed)
├── layout.tsx        Fonts (Helvetica webfont + Space Mono) + providers
└── globals.css       Design tokens + glass/pulse/marquee classes

components/
├── on-air-console.tsx    Euterpe's live "ON AIR" transmitter (landing signature)
├── afromeet-header.tsx   Workspace header (USDC balance, wallet)
├── media-player.tsx      Per-second metered streaming + discrete unlock (x402)
├── mint-form.tsx         Creator Studio — mint, set access terms + royalty splits
├── marketplace-panel.tsx Buy NFTs / fractional shares / claim vault revenue
├── dao-panel.tsx         Creator DAO — proposals + VIBE voting
├── creator-dashboard.tsx Earnings + owned works
├── agent-monitor.tsx     Euterpe's console + manual run trigger
└── agent-picks.tsx       What Euterpe is enjoying (on-chain recommendation feed)
```

## Build

```bash
pnpm build   # next build (Turbopack) — fetches Space Mono at build time, needs network
```

Deployed at https://afromeet-x.vercel.app.
