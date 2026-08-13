export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  operatorApiKey: process.env.OPERATOR_API_KEY,
  corsOrigins: (
    process.env.CORS_ORIGINS ??
    'http://localhost:3001,https://afromeet.vercel.app'
  ).split(','),

  arc: {
    rpcUrl: process.env.ARC_RPC_URL,
    chainId: 5042002,
  },

  // Deployed contracts. USDC is Arc's system token; the rest come from our deploy script.
  contracts: {
    usdc: process.env.USDC_ADDRESS ?? '',
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
    walletId: process.env.CIRCLE_WALLET_ID,
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // Fallback judgment provider — used only when ANTHROPIC_API_KEY is unset (see decision-engine.service.ts).
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
  },

  services: {
    walletAddress: process.env.CIRCLE_SERVICES_WALLET,
    chain: process.env.SERVICES_CHAIN ?? 'BASE-SEPOLIA',
    maxUsdc: parseFloat(process.env.SERVICES_MAX_USDC ?? '0.05'),
  },

  // Patron Agent parameters.
  agent: {
    budgetUsdc: parseFloat(process.env.AGENT_BUDGET_USDC ?? '10'),
    minScore: 0.6,
    maxPerWorkUsdc: parseFloat(process.env.AGENT_MAX_PER_WORK_USDC ?? '2'),
    sampleLimit: parseInt(process.env.AGENT_SAMPLE_LIMIT ?? '3', 10),
    model: process.env.AGENT_MODEL ?? 'claude-sonnet-4-6',
  },

  // ERC-8004 agent identity + reputation (registries live on Arc Testnet).
  erc8004: {
    identityRegistry: process.env.ERC8004_IDENTITY_REGISTRY_ADDRESS ?? '',
    reputationRegistry: process.env.ERC8004_REPUTATION_REGISTRY_ADDRESS ?? '',
    validationRegistry: process.env.ERC8004_VALIDATION_REGISTRY_ADDRESS ?? '',
    agentId: process.env.ERC8004_AGENT_ID,
    metadataUri: process.env.ERC8004_METADATA_URI ?? '',
  },

  mongodbUri: process.env.MONGODB_URI,
  pinataJwt: process.env.PINATA_JWT,
  ipfsGateway: process.env.IPFS_GATEWAY ?? '',
  minAccessSeconds: parseInt(process.env.MIN_ACCESS_SECONDS ?? '30', 10),
});
