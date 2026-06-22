# AfroMeet Contracts

Foundry project for the AfroMeet onchain layer — Solidity 0.8 / OpenZeppelin v5, deployed on **Arc Testnet (chain 5042002)**.

## Contracts

| Contract | Purpose |
| -------- | ------- |
| `AfroMeetNFT` | ERC-721 creative works. First mint per creator auto-creates their ecosystem (token + DAO + treasury) and distributes a CreatorVibeToken reward. |
| `CreatorVibeToken` | ERC-20 + ERC20Votes governance token, one per creator. |
| `CreatorDAO` | OpenZeppelin Governor, one per creator. 4% quorum, non-zero proposal threshold. |
| `CreatorDAOFactory` | Deploys `CreatorDAO` instances (extracted so `AfroMeetNFT` stays under the EIP-170 24KB limit). |
| `DAOTreasury` | Receives 1% of every access settlement. 24h timelock on DAO-governed disbursements. |
| `AccessRegistry` | Per-work access config (rate, discovery price, mode, min duration). Resolves the DAO treasury from the creator's ecosystem. |
| `SplitResolver` | Per-tokenId royalty splits (sum = 10000). Immutable after first settlement. |
| `AccessEscrow` | Settles a session: 1% to the DAO treasury, remainder split per `SplitResolver`. |
| `AfroMeetRoyalty` | EIP-2981-style secondary-sale royalties. |
| `AfroMeetMarketplace` | List / buy / resell in USDC; 2% cultural cut, royalty on resale. |
| `FractionalVault` | Locks one ERC-721 and mints ERC-20 shares. Per-access revenue distributed pro-rata; primary share sale (`configureSale` / `buyShares`); 100%-holder `redeem`. |
| `FractionalVaultFactory` | Deploys and tracks `FractionalVault` instances. |

## Build & test

```bash
forge build
forge test          # 66 tests
forge build --sizes # all contracts under the 24KB EIP-170 limit
```

> The optimizer is enabled with `via_ir` and `optimizer_runs = 1` (see `foundry.toml`) to keep the
> Governor-bearing contracts under the EIP-170 code-size limit.

## Deploy

```bash
cp .env.example .env      # set ARC_RPC_URL + a funded PRIVATE_KEY
forge script script/DeployAfroMeet.s.sol --rpc-url arc --broadcast
```

The script deploys in dependency order, wires `SplitResolver`'s escrow, and prints all addresses.
`USDC` defaults to Arc's system token; `OPERATOR_ADDRESS` / `CULTURAL_POOL_ADDRESS` default to the deployer.

## Deployed addresses (Arc Testnet)

| Contract | Address |
| -------- | ------- |
| AfroMeetNFT | `0x9A8c6Df48613265Ea2b90f1e4Dd85eC3Ca9A85DE` |
| CreatorDAOFactory | `0x8aEE6C72598200E1720300607D6d20812Ec9bc61` |
| AccessRegistry | `0x5363eACF9b04CAfcD1DDb0dc5365532644A1B46A` |
| AccessEscrow | `0xB14a5927b20927A8812AC060c00CBE17772CcFA0` |
| SplitResolver | `0x4cdd345EEFbfFE00F004C64Fe72da6EC667f8852` |
| AfroMeetRoyalty | `0x3D1A6E616CA3bc7fAb7cc178aF434071ddeAbC4f` |
| AfroMeetMarketplace | `0x892C2C0eD81f80Ba727af29c7A128A4A2e9d053c` |
| FractionalVaultFactory | `0xe41e15b91Ae30f3cB4f0193c4ca1f00c82342D8f` |

## Security notes

Internally audited. Resolved: DAO-treasury resolution (can't be redirected by a creator), a
stranded-fund guard in settlement, a non-zero proposal threshold, and reentrancy guards on
`mintWork` / vault / escrow / marketplace. Deferred: the access escrow uses a USDC allowance model —
migrating to **EIP-3009** signed authorizations (per TRD §12.1) is the recommended next hardening.
