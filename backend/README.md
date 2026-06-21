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
| GET | `/access/config/:tokenId` | Public access config for a work |
| GET | `/access/:tokenId` | **x402**: 402 until USDC paid to creator, then content |
| POST | `/access/session/open` | Operator opens a metered session |
| POST | `/access/session/settle` | Settle → splits + 1% DAO cut |
| GET | `/agent/status` | Agent wallet + ERC-8004 id |
| POST | `/agent/run` | Trigger one autonomous pass |
| POST | `/agent/wallet/provision` | One-time SDK wallet provisioning |
| POST | `/agent/metadata` | Update the agent's ERC-8004 metadata URI |

## The Patron Agent

`discover` (enumerate active works) → `sample` (pay discovery nanopayment) → `evaluate` (Claude scores using on-chain revenue momentum) → `backWork` (approve + `buyShares`) → `recordReputation` (ERC-8004). Deterministic guardrails (budget caps, share math) wrap the model's judgment. Runs on a 30-minute cron or via `POST /agent/run`.

## Wallets (Arc Testnet)

- On-chain signer (Circle SDK): `0xf99337df8acbdce3221372ea41610d38b54ca33f`
- x402 services (Circle CLI): `0xde4e3db5135ce706931fb19cfbe53df30ad0100d`
- ERC-8004 agent id: `839408`
