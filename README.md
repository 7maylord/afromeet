# AfroMeet

**Own the work. Get paid every time it's experienced.**

A decentralised platform for African creatives — musicians, filmmakers, writers, visual artists, photographers, from Lagos to Nairobi to Kinshasa — to own, monetise, and govern their creative work onchain, with payments settled as **USDC nanopayments on Arc**.

Built for the **Lepton Agents Hackathon** (Canteen × Circle × Arc, June 2026).

---

## The crux

Three things, all paid for with Circle nanopayments:

1. **Fractional ownership** — buy a portion of a song, film, photo or artwork. A work NFT is locked in a `FractionalVault` and split into ERC-20 shares; per-access revenue flows to share holders pro-rata.
2. **Per-access streaming** — pay per play / watch / read / view. No subscription. A Lagos stream and a Stockholm stream pay the **same** rate, settled to the creator in under 500ms.
3. **Euterpe, an autonomous Patron Agent** — AfroMeet's resident selector (named for the muse of music). An AI agent with its own Circle wallet and a USDC budget that discovers creators, samples their work via x402 nanopayments, evaluates them (Claude judgment + on-chain revenue momentum), and backs the promising ones by buying fractional shares and streaming — with an on-chain **ERC-8004** identity and reputation.

The structural problem: one million Spotify streams in Nigeria pays ~$300; the same in Sweden pays up to $10,000. AfroMeet on Arc bypasses territorial/platform pricing entirely.

---

## Architecture

| Layer | Stack | Responsibility |
| ----- | ----- | -------------- |
| Contracts | Solidity 0.8, Foundry, OpenZeppelin v5 | NFT minting, royalty splits, DAO governance, treasury, access escrow, fractional vaults |
| Payments | Circle Gateway, x402, Arc | Per-access USDC settlement, gasless batching |
| Backend | NestJS, ethers v6, Circle SDK, Anthropic | x402 discovery, session settlement, Euterpe (the Patron Agent) |
| Agent identity | ERC-8004 (Arc) | On-chain agent identity + reputation |

```
afromeet/
├── contracts/          Foundry project — Solidity contracts + tests + deploy script
├── backend/            NestJS API — Circle wallets, x402, access settlement, Euterpe (Patron Agent)
├── agent-card.json     ERC-8004 agent metadata
└── AfroMeet_PRD_TRD.md Full product + technical reference
```

See [contracts/README.md](contracts/README.md) and [backend/README.md](backend/README.md) for setup.

---

## Deployed — Arc Testnet (chain `5042002`)

| Contract | Address |
| -------- | ------- |
| AfroMeetNFT | `0x9A8c6Df48613265Ea2b90f1e4Dd85eC3Ca9A85DE` |
| AccessRegistry | `0x5363eACF9b04CAfcD1DDb0dc5365532644A1B46A` |
| AccessEscrow | `0xB14a5927b20927A8812AC060c00CBE17772CcFA0` |
| SplitResolver | `0x4cdd345EEFbfFE00F004C64Fe72da6EC667f8852` |
| AfroMeetRoyalty | `0x3D1A6E616CA3bc7fAb7cc178aF434071ddeAbC4f` |
| AfroMeetMarketplace | `0x892C2C0eD81f80Ba727af29c7A128A4A2e9d053c` |
| FractionalVaultFactory | `0xe41e15b91Ae30f3cB4f0193c4ca1f00c82342D8f` |
| CreatorDAOFactory | `0x8aEE6C72598200E1720300607D6d20812Ec9bc61` |
| USDC (Arc system token) | `0x3600000000000000000000000000000000000000` |

**Euterpe (Patron Agent)** — ERC-8004 agent id `839408` · identity registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- On-chain signer (Circle SDK wallet): `0xf99337df8acbdce3221372ea41610d38b54ca33f`
- x402 services wallet (Circle CLI): `0xde4e3db5135ce706931fb19cfbe53df30ad0100d`

---

## Links

- **Product & Technical Reference:** [AfroMeet_PRD_TRD.md](AfroMeet_PRD_TRD.md)
- **Frontend:** https://afromeet-x.vercel.app
- **Explorer:** Arc testnet
