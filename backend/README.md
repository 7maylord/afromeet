# AfroMeet Backend

NestJS API for AfroMeet — Circle wallets, x402 discovery, per-access settlement, and the autonomous **Patron Agent**. Talks to the contracts on **Arc Testnet** via ethers v6, and signs onchain through a Circle developer-controlled wallet.

## Stack

- **NestJS 11** + **ethers v6** (Arc reads + calldata encoding)
- **Circle** — `@circle-fin/developer-controlled-wallets` (programmatic on-chain signer) + Circle CLI Agent Wallet (x402 services)
- **Anthropic SDK** — Claude judgment for the agent's evaluation
- **ERC-8004** — on-chain agent identity + reputation

## Modules

| Module | Responsibility |
| ------ | -------------- |
| `chain` → `BlockchainService` | ethers provider, contract reads, calldata encoders |
| `circle` → `WalletsService` | Circle wallet: provision, sign contract calls, poll txs |
| `circle` → `Erc8004Service` | Register the agent + record reputation + update metadata |
| `access` → `NanopaymentGuard` + `AccessController` | x402 discovery gate + metered streaming sessions |
| `agent` → `AgentService` + `DecisionEngineService` | The Patron Agent loop (cron + manual trigger) |

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill `.env`:

- `ARC_RPC_URL` — Canteen-hosted Arc RPC (boots the chain layer)
- contract addresses (from the deploy script — see `../contracts/README.md`)
- `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET` — from the Circle Developer Console (Testnet). The entity secret must be **registered** with Circle before wallets can be created.
- `CIRCLE_WALLET_ID` — set after provisioning (below)
- `ANTHROPIC_API_KEY`
- `PINATA_JWT` — server-side Pinata JWT for creator work uploads (`POST /works/upload`)
- `ERC8004_AGENT_ID` — **set this after first registration** (the log prints it), or the agent re-registers on every boot
- `ERC8004_METADATA_URI` — your agent-card IPFS link

## Run

```bash
pnpm start:dev
```

- **Swagger UI:** http://localhost:3000/docs
- **Health:** `GET /health` → Arc chain id + latest block + agent wallet

### Provision the on-chain wallet (one-time)

```bash
curl -X POST localhost:3000/agent/wallet/provision   # → { walletId, address }
```

Put `walletId` in `CIRCLE_WALLET_ID`, fund the returned address with testnet USDC, restart. The agent auto-registers on ERC-8004 on boot.

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/health` | Liveness + Arc connection |
| POST | `/works/upload` | Pin a work + metadata to IPFS (Pinata); returns the tokenURI |
| GET | `/access/catalogue` | Every active work on-chain with pricing + tokenURI |
| GET | `/access/config/:tokenId` | Public access config for a work |
| GET | `/access/:tokenId` | **x402**: 402 until USDC paid to creator, then content |
| POST | `/access/session/open` | Operator opens a metered session |
| GET | `/access/session/heartbeat` | Live accrued cost after N seconds (the ticking meter) |
| POST | `/access/session/settle` | Settle metered seconds → splits + 1% DAO cut |
| GET | `/agent/status` | Agent wallet + ERC-8004 id |
| POST | `/agent/run` | Trigger one autonomous pass |
| GET | `/agent/picks` | What the agent is enjoying — the recommendation feed |
| POST | `/agent/wallet/provision` | One-time SDK wallet provisioning |
| POST | `/agent/metadata` | Update the agent's ERC-8004 metadata URI |
| GET | `/services/search?q=&category=` | Search the x402 paid-API marketplace |
| GET | `/services/inspect?url=` | Inspect a service (pricing, schema, health) |
| POST | `/services/pay` | Pay an x402 endpoint from the agent BASE wallet |

## x402 services leg (RFB-01)

The agent can autonomously discover, evaluate, and pay for **external** paid APIs via Circle's x402
marketplace (`ServicesService` wraps the `circle services` CLI). During a run it buys research to
inform each evaluation. Defaults to **Base Sepolia** (`SERVICES_CHAIN=BASE-SEPOLIA`) so it spends
**free testnet USDC** — fund the CLI agent wallet from a Base Sepolia faucet. Set `SERVICES_CHAIN=BASE`
for the mainnet directory (real USDC, more web-research services). Every payment is capped by
`SERVICES_MAX_USDC`; leave `CIRCLE_SERVICES_WALLET` empty to disable the leg.

## The Patron Agent

`discover` (enumerate active works) → `sample` (pay the per-access nanopayment to *consume* the work) → `research` (buy external context via x402 services) → `evaluate` (Claude scores using on-chain revenue momentum) → **like** (records a public pick) → optionally `backWork` (approve + `buyShares`) → `recordReputation` (ERC-8004). Deterministic guardrails (budget caps, share math) wrap the model's judgment. Runs on a 30-minute cron or via `POST /agent/run`; its likes surface at `GET /agent/picks` as a recommendation feed.

## Tests

```bash
pnpm test
```

Unit tests cover the deterministic, security-critical logic without needing live infra:
- **`blockchain.service.spec.ts`** — calldata encoders round-trip (the backend signs exactly what it intends).
- **`access.service.spec.ts`** — per-second meter math + skip-gate + metered settle.
- **`nanopayment.guard.spec.ts`** — the x402 gate: free discovery, 402 instructions, payment verification, underpayment rejection, and replay dedup.

## Wallets (Arc Testnet)

- On-chain signer (Circle SDK, Arc): `0xf99337df8acbdce3221372ea41610d38b54ca33f`
- x402 services (Circle CLI, **Base Sepolia**, free testnet USDC): `0xde4e3db5135ce706931fb19cfbe53df30ad0100d`
- ERC-8004 agent id: `839408`
