# AfroMeet

**Own the work. Get paid every time it's experienced.**

A decentralised platform for West African creatives — musicians, filmmakers, writers, visual artists, photographers — to own, monetise, and govern their creative work onchain, with payments settled as **USDC nanopayments on Arc**.

Built for the **Lepton Agents Hackathon** (Canteen × Circle × Arc, June 2026).

---

## The crux

Three things, all paid for with Circle nanopayments:

1. **Fractional ownership** — buy a portion of a song, film, photo or artwork. A work NFT is locked in a `FractionalVault` and split into ERC-20 shares; per-access revenue flows to share holders pro-rata.
2. **Per-access streaming** — pay per play / watch / read / view. No subscription. A Lagos stream and a Stockholm stream pay the **same** rate, settled to the creator in under 500ms.
3. **An autonomous Patron Agent** — an AI agent with its own Circle wallet and a USDC budget that discovers creators, samples their work via x402 nanopayments, evaluates them, and backs the promising ones by buying fractional shares and streaming — with an on-chain **ERC-8004** identity and reputation.

The structural problem: one million Spotify streams in Nigeria pays ~$300; the same in Sweden pays up to $10,000. AfroMeet on Arc bypasses territorial/platform pricing entirely.

---

## Architecture

| Layer | Stack | Responsibility |
| ----- | ----- | -------------- |
| Contracts | Solidity 0.8, Foundry, OpenZeppelin v5 | NFT minting, royalty splits, DAO governance, treasury, access escrow, fractional vaults |
| Payments | Circle Gateway, x402, Arc | Per-access USDC settlement, gasless batching |
| Backend | NestJS, ethers v6, Circle SDK, Anthropic | x402 discovery, session settlement, the Patron Agent |
| Agent identity | ERC-8004 (Arc) | On-chain agent identity + reputation |

```
afromeet/
├── contracts/          Foundry project — Solidity contracts + tests + deploy script
├── backend/            NestJS API — Circle wallets, x402, access settlement, Patron Agent
├── agent-card.json     ERC-8004 agent metadata
└── AfroMeet_PRD_TRD.md Full product + technical reference
```

See [contracts/README.md](contracts/README.md) and [backend/README.md](backend/README.md) for setup.

---

## Deployed — Arc Testnet (chain `5042002`)

| Contract | Address |
| -------- | ------- |
| AfroMeetNFT | `0xef0eE06EBfB7536DfCe6Db0c83Aa460Ef3eD8322` |
| AccessRegistry | `0xa451F452055351dE4745619414FDA08f1175C3a6` |
| AccessEscrow | `0x6A6B8D57b776B2a0A34809B1F6782f90e6Ba0ffD` |
| SplitResolver | `0x49fa30F9BE0158cE135fa42D390AD4664362ff9A` |
| AfroMeetRoyalty | `0x2e42160576AaFB649d61f2BbC1e3106B614ca761` |
| AfroMeetMarketplace | `0x254E7A6971DfDd5bcD04F7a4A8fc541a35b6bdE2` |
| FractionalVaultFactory | `0x93B67Ae7c49e57A1c2C1b014F6DB31180699573c` |
| CreatorDAOFactory | `0x095677F720ff38d163b77ee31b40909688E3c4C7` |
| USDC (Arc system token) | `0x3600000000000000000000000000000000000000` |

**Patron Agent** — ERC-8004 agent id `839408` · identity registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- On-chain signer (Circle SDK wallet): `0xf99337df8acbdce3221372ea41610d38b54ca33f`
- x402 services wallet (Circle CLI): `0xde4e3db5135ce706931fb19cfbe53df30ad0100d`

---

## Links

- **Product & Technical Reference:** [AfroMeet_PRD_TRD.md](AfroMeet_PRD_TRD.md)
- **Frontend:** https://afromeet-x.vercel.app
- **Explorer:** Arc testnet
