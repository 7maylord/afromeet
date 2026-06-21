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
forge test          # 63 tests
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
| AfroMeetNFT | `0xef0eE06EBfB7536DfCe6Db0c83Aa460Ef3eD8322` |
| CreatorDAOFactory | `0x095677F720ff38d163b77ee31b40909688E3c4C7` |
| AccessRegistry | `0xa451F452055351dE4745619414FDA08f1175C3a6` |
| AccessEscrow | `0x6A6B8D57b776B2a0A34809B1F6782f90e6Ba0ffD` |
| SplitResolver | `0x49fa30F9BE0158cE135fa42D390AD4664362ff9A` |
| AfroMeetRoyalty | `0x2e42160576AaFB649d61f2BbC1e3106B614ca761` |
| AfroMeetMarketplace | `0x254E7A6971DfDd5bcD04F7a4A8fc541a35b6bdE2` |
| FractionalVaultFactory | `0x93B67Ae7c49e57A1c2C1b014F6DB31180699573c` |

## Security notes

Internally audited. Resolved: DAO-treasury resolution (can't be redirected by a creator), a
stranded-fund guard in settlement, a non-zero proposal threshold, and reentrancy guards on
`mintWork` / vault / escrow / marketplace. Deferred: the access escrow uses a USDC allowance model —
migrating to **EIP-3009** signed authorizations (per TRD §12.1) is the recommended next hardening.
