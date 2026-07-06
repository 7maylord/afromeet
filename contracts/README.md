# AfroMeet Contracts

Foundry project for the AfroMeet onchain layer — Solidity 0.8 / OpenZeppelin v5, deployed on **Arc Testnet (chain 5042002)**.

## Contracts

| Contract                 | Purpose                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AfroMeetNFT`            | ERC-721 creative works. First mint per creator auto-creates their ecosystem (token + DAO + treasury) and distributes a CreatorVibeToken reward.               |
| `CreatorVibeToken`       | ERC-20 + ERC20Votes governance token, one per creator.                                                                                                        |
| `CreatorDAO`             | OpenZeppelin Governor, one per creator. 4% quorum, non-zero proposal threshold.                                                                               |
| `CreatorDAOFactory`      | Deploys `CreatorDAO` instances (extracted so `AfroMeetNFT` stays under the EIP-170 24KB limit).                                                               |
| `DAOTreasury`            | Receives 1% of every access settlement. 24h timelock on DAO-governed disbursements.                                                                           |
| `AccessRegistry`         | Per-work access config (rate, discovery price, mode, min duration). Resolves the DAO treasury from the creator's ecosystem.                                   |
| `SplitResolver`          | Per-tokenId royalty splits (sum = 10000). Immutable after first settlement.                                                                                   |
| `AccessEscrow`           | Settles a session: 1% to the DAO treasury, remainder split per `SplitResolver`.                                                                               |
| `AfroMeetRoyalty`        | EIP-2981-style secondary-sale royalties.                                                                                                                      |
| `AfroMeetMarketplace`    | List / buy / resell in USDC; 2% cultural cut, royalty on resale.                                                                                              |
| `FractionalVault`        | Locks one ERC-721 and mints ERC-20 shares. Per-access revenue distributed pro-rata; primary share sale (`configureSale` / `buyShares`); 100%-holder `redeem`. |
| `FractionalVaultFactory` | Deploys and tracks `FractionalVault` instances.                                                                                                               |

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

| Contract               | Address                                      |
| ---------------------- | -------------------------------------------- |
| AfroMeetNFT            | `0xb2ffb8d43b20dd6086f0909f90565f658c14c2c4` |
| CreatorDAOFactory      | `0x325538df752aeda5e0df887061f36be152b0d0d0` |
| AccessRegistry         | `0x89661826e41b548098ab73d0957f8d7c843d0505` |
| AccessEscrow           | `0x758b2dd0e09ec736aafdfdeee26e87f4b1c4315a` |
| SplitResolver          | `0x862d28cd9e40ea461a0be2b3f1150d0c91f7de34` |
| AfroMeetRoyalty        | `0xb182db5655b7884df727ae0b7295949182ddeae7` |
| AfroMeetMarketplace    | `0x34b84deffe4a69b1ef87805a38c867a9c4b3e4f2` |
| FractionalVaultFactory | `0x41a1b2ea32e3906e91d27aee180a36cb5a677140` |
