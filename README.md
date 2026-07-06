# AfroMeet

**Own the work. Get paid every time it's experienced.**

A decentralised platform for African creatives — musicians, filmmakers, writers, visual artists, photographers, from Lagos to Nairobi to Kinshasa — to own, monetise, and govern their creative work onchain, with payments settled as **USDC nanopayments on Arc**.
The logo is a **cowrie shell** — Africa's original small change, the continent's answer to the lepton.

---

## The crux

Three things, all paid for with Circle nanopayments:

1. **Fractional ownership** — buy a portion of a song, film, photo or artwork. A work NFT is locked in a `FractionalVault` and split into ERC-20 shares; per-access revenue flows to share holders pro-rata.
2. **Per-access streaming** — pay per play / watch / read / view. No subscription. A Lagos stream and a Stockholm stream pay the **same** rate, settled to the creator in under 500ms.
3. **Euterpe, an autonomous Patron Agent** — AfroMeet's resident selector (named for the muse of music). An AI agent with its own Circle wallet and a USDC budget that discovers creators, samples their work via x402 nanopayments, evaluates them (Claude judgment + on-chain revenue momentum), and backs the promising ones by buying fractional shares and streaming — with an on-chain **ERC-8004** identity and reputation.

The structural problem: one million Spotify streams in Nigeria pays ~$300; the same in Sweden pays up to $10,000. AfroMeet on Arc bypasses territorial/platform pricing entirely.

---

## Architecture

| Layer          | Stack                                    | Responsibility                                                                          |
| -------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Contracts      | Solidity 0.8, Foundry, OpenZeppelin v5   | NFT minting, royalty splits, DAO governance, treasury, access escrow, fractional vaults |
| Payments       | Circle Gateway, x402, Arc                | Per-access USDC settlement, gasless batching                                            |
| Backend        | NestJS, ethers v6, Circle SDK, Anthropic | x402 discovery, session settlement, Euterpe (the Patron Agent)                          |
| Agent identity | ERC-8004 (Arc)                           | On-chain agent identity + reputation                                                    |

```
afromeet/
├── contracts/          Foundry project — Solidity contracts + tests + deploy script
├── backend/            NestJS API — Circle wallets, x402, access settlement, Euterpe (Patron Agent)
│                       Swagger docs at /docs when running
├── client/             Next.js 16 frontend — landing + authenticated workspace
└── agent-card.json     ERC-8004 agent metadata (Euterpe, agent id 839408)
```

See [contracts/README.md](contracts/README.md) and [backend/README.md](backend/README.md) for setup.

---

## Deployed — Arc Testnet (chain `5042002`)

| Contract                | Address                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| AfroMeetNFT             | [`0xb2ffb8d43b20dd6086f0909f90565f658c14c2c4`](https://testnet.arcscan.app/address/0xb2ffb8d43b20dd6086f0909f90565f658c14c2c4) |
| AccessRegistry          | [`0x89661826e41b548098ab73d0957f8d7c843d0505`](https://testnet.arcscan.app/address/0x89661826e41b548098ab73d0957f8d7c843d0505) |
| AccessEscrow            | [`0x758b2dd0e09ec736aafdfdeee26e87f4b1c4315a`](https://testnet.arcscan.app/address/0x758b2dd0e09ec736aafdfdeee26e87f4b1c4315a) |
| SplitResolver           | [`0x862d28cd9e40ea461a0be2b3f1150d0c91f7de34`](https://testnet.arcscan.app/address/0x862d28cd9e40ea461a0be2b3f1150d0c91f7de34) |
| AfroMeetRoyalty         | [`0xb182db5655b7884df727ae0b7295949182ddeae7`](https://testnet.arcscan.app/address/0xb182db5655b7884df727ae0b7295949182ddeae7) |
| AfroMeetMarketplace     | [`0x34b84deffe4a69b1ef87805a38c867a9c4b3e4f2`](https://testnet.arcscan.app/address/0x34b84deffe4a69b1ef87805a38c867a9c4b3e4f2) |
| FractionalVaultFactory  | [`0x41a1b2ea32e3906e91d27aee180a36cb5a677140`](https://testnet.arcscan.app/address/0x41a1b2ea32e3906e91d27aee180a36cb5a677140) |
| CreatorDAOFactory       | [`0x325538df752aeda5e0df887061f36be152b0d0d0`](https://testnet.arcscan.app/address/0x325538df752aeda5e0df887061f36be152b0d0d0) |
| USDC (Arc system token) | [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) |

All eight are verified on [ArcScan](https://testnet.arcscan.app).

**Euterpe (Patron Agent)** — ERC-8004 agent id `839408` · identity registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`

- On-chain signer (Circle SDK wallet): `0xf99337df8acbdce3221372ea41610d38b54ca33f`
- x402 services wallet (Circle CLI): `0xde4e3db5135ce706931fb19cfbe53df30ad0100d`

---

## Links

- **Frontend:** https://afromeet.vercel.app
- **Explorer:** Arc testnet
