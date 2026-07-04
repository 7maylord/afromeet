# AfroMeet — 3-Minute Demo Script (Lepton Agents Hackathon)

Target: 2:50 spoken (~430 words, leaves buffer under the 3:00 cap).
Rule while recording: the voiceover never waits for the UI — pre-load every tab, pre-trigger Euterpe's loop so txs are landing during the take.

---

## 0:00 – 0:20 · Cold open — the cowrie

**ON SCREEN:** The cowrie logo full-frame, then slow zoom out to the landing page hero (boomerang video + ON AIR console live).

> This hackathon is named for the lepton — the smallest coin of the Greek world. Africa never minted one. We didn't need to. We used the cowrie shell — the original small change of an entire continent. That cowrie is our logo. AfroMeet is the cowrie reborn as the nanopayment, settled on Arc.

## 0:20 – 0:45 · The problem

**ON SCREEN:** Scroll the landing page — Catalogue section, ember per-play prices visible ($0.0001 / play).

> For creators from Lagos to Nairobi to Kinshasa, the payment floor was a locked door. You can't sell one play of a track for a fraction of a cent when the fee is thirty cents. AfroMeet removes the floor: every work is an NFT on Arc, and every second someone listens is a USDC payment straight to the maker.

## 0:45 – 1:45 · Euterpe — the agent (the core minute)

**ON SCREEN:** The app's Euterpe tab. Show, in order: her live console logs, a Claude judgment appearing, an ArcScan settlement tx, the picks feed, then a share-purchase tx.

> But our first patron isn't human. Meet Euterpe. She has her own Circle wallet, her own daily budget, and on-chain identity — ERC-8004 agent number 839408 on Arc.
>
> On every loop she browses the catalogue and discovers gated works through x402 — HTTP 402, payment required. Claude is her judgment: she decides what's worth her money, then pays the exact same per-second nanopayments a human listener does. If a track loses her, she ends the session — and the spending stops with it.
>
> When she genuinely loves a work, she goes further: she buys fractional shares in it. Her taste isn't a score — it's capital at risk, recorded to her ERC-8004 reputation. And every decision — what she played, what she skipped, what she paid, and why — is public in her picks feed. Nothing here is scripted. The spending decisions are hers.

## 1:45 – 2:25 · The human loop

**ON SCREEN:** Mint form (upload → encrypt → pin → mint), then the media player with the live per-second meter counting up, then the creator dashboard earnings.

> For creators: upload a track, it's AES-encrypted, pinned to IPFS as ciphertext, minted as an NFT — the key is released only on payment. Set a rate per second.
>
> Listeners pre-authorize a budget and just press play. The meter runs; settlement splits automatically on-chain — creator, collaborators, DAO treasury, and every fractional shareholder, pro-rata. Skip in the first seconds? Costs nothing. And a patron who bought shares early earns from every future play — patronage you can resell.

## 2:25 – 2:50 · Stack + close

**ON SCREEN:** ArcScan showing the deployed contracts / recent tx stream, then cut back to the cowrie logo with the wordmark.

> Under the hood: the full Circle stack. Developer-controlled wallets sign for Euterpe on Arc, her CLI agent wallet pays for x402 services, and eight contracts settle everything in USDC — gas included.
>
> The cowrie moved value too small for coins, for a thousand years. On Arc, it moves again.
>
> AfroMeet — Africa's underground, pressed onchain. Own the cut. Get paid every play.

---

## Shot checklist (prep before recording)

- [ ] Euterpe's loop triggered ~2 min before the take so fresh txs/logs are visible live
- [ ] ArcScan tabs pre-loaded: one settlement tx, one share purchase, the agent wallet
- [ ] A work pre-minted for the mint-form shot (don't wait for IPFS on camera)
- [ ] A listener wallet pre-funded so the player meter runs instantly
- [ ] Landing page at `#top`, app tabs in order: Euterpe → player → mint → dashboard
- [ ] OS notifications off, browser zoom ~110% for legibility
