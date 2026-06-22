/**
 * Application configuration. Nested, untyped-by-path style (matches the prior Arc/Circle build)
 * so services read e.g. `config.get<string>('arc.rpcUrl')`. Hard Arc facts (chainId, USDC) are
 * baked in; only secrets and deployed addresses come from the environment.
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),

  // Arc Testnet — chainId is fixed for the Lepton hackathon network.
  arc: {
    rpcUrl: process.env.ARC_RPC_URL,
    chainId: 5042002,
  },

  // Deployed contracts. USDC is Arc's system token; the rest come from our deploy script.
  contracts: {
    usdc: process.env.USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000',
    afroMeetNft: process.env.AFROMEET_NFT_ADDRESS,
    accessRegistry: process.env.ACCESS_REGISTRY_ADDRESS,
    accessEscrow: process.env.ACCESS_ESCROW_ADDRESS,
    splitResolver: process.env.SPLIT_RESOLVER_ADDRESS,
    royalty: process.env.ROYALTY_ADDRESS,
    marketplace: process.env.MARKETPLACE_ADDRESS,
    fractionalVaultFactory: process.env.FRACTIONAL_VAULT_FACTORY_ADDRESS,
  },

  // Circle Developer-Controlled Wallets (agent + operator).
  circle: {
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    walletId: process.env.CIRCLE_WALLET_ID, // set after first createWallet() run
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // x402 services marketplace (Circle CLI). Defaults to Base Sepolia (testnet USDC); set
  // SERVICES_CHAIN=BASE for the mainnet directory (real USDC, more web-research services).
  services: {
    walletAddress: process.env.CIRCLE_SERVICES_WALLET, // CLI agent wallet; empty disables the leg
    chain: process.env.SERVICES_CHAIN ?? 'BASE-SEPOLIA',
    maxUsdc: parseFloat(process.env.SERVICES_MAX_USDC ?? '0.05'),
  },

  // Patron Agent parameters.
  agent: {
    budgetUsdc: parseFloat(process.env.AGENT_BUDGET_USDC ?? '10'),
    minScore: 0.6, // Claude score threshold to back a creator
    maxPerWorkUsdc: parseFloat(process.env.AGENT_MAX_PER_WORK_USDC ?? '2'),
    sampleLimit: parseInt(process.env.AGENT_SAMPLE_LIMIT ?? '3', 10),
    // Sonnet by default — the loop makes many calls, so the cheaper judgment model fits.
    model: process.env.AGENT_MODEL ?? 'claude-sonnet-4-6',
  },

  // ERC-8004 agent identity + reputation (registries live on Arc Testnet).
  erc8004: {
    identityRegistry: process.env.ERC8004_IDENTITY_REGISTRY_ADDRESS ?? '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    reputationRegistry: process.env.ERC8004_REPUTATION_REGISTRY_ADDRESS ?? '0x8004B663056A597Dffe9eCcC1965A193B7388713',
    validationRegistry: process.env.ERC8004_VALIDATION_REGISTRY_ADDRESS ?? '0x8004Cb1BF31DAf7788923b405b754f57acEB4272',
    agentId: process.env.ERC8004_AGENT_ID, // set after first registration
    metadataUri: process.env.ERC8004_METADATA_URI ?? 'ipfs://REPLACE_WITH_AGENT_METADATA',
  },

  pinataJwt: process.env.PINATA_JWT, // server-side Pinata JWT for work uploads
  ipfsGateway: process.env.IPFS_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs/',
  minAccessSeconds: parseInt(process.env.MIN_ACCESS_SECONDS ?? '30', 10),
});
