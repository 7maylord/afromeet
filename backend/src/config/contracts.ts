/**
 * Human-readable ABI fragments for the AfroMeet contracts — only the functions the backend calls.
 * Keeps the bundle small and avoids shipping full Foundry artifacts.
 */

export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

export const AFROMEET_NFT_ABI = [
  'function creatorOf(uint256 tokenId) view returns (address)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function nextTokenId() view returns (uint256)',
  'function treasuryOf(address creator) view returns (address)',
  'function ecosystemOf(address creator) view returns (tuple(address token, address dao, address treasury, bool exists))',
  'function mintWork(string uri) returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

export const MARKETPLACE_ABI = [
  'event Bought(uint256 indexed tokenId, address indexed buyer, uint256 price)',
];

export const CREATOR_DAO_ABI = [
  'function state(uint256 proposalId) view returns (uint8)',
  'function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)',
  'function proposalDeadline(uint256 proposalId) view returns (uint256)',
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
  'function castVote(uint256 proposalId, uint8 support) returns (uint256)',
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)',
];

export const DAO_TREASURY_ABI = [
  'function balance() view returns (uint256)',
  'function queueDisbursement(address to, uint256 amount) returns (uint256)',
];

export const ACCESS_REGISTRY_ABI = [
  'function getConfig(uint256 tokenId) view returns (tuple(uint256 pricePerAccess, uint256 discoveryPrice, uint256 ratePerSecond, uint8 mode, uint256 minAccessSeconds, address daoTreasury, bool active))',
  'function setConfig(uint256 tokenId, uint256 pricePerAccess, uint256 discoveryPrice, uint256 ratePerSecond, uint8 mode, uint256 minAccessSeconds)',
];

export const ACCESS_ESCROW_ABI = [
  'function openSession(bytes32 sessionId, address listener, uint256 tokenId, uint256 authorisedAmount)',
  'function settle(bytes32 sessionId, uint256 elapsedSeconds)',
  'function sessions(bytes32 sessionId) view returns (address listener, uint256 tokenId, uint256 authorisedAmount, bool settled)',
  'event Settled(bytes32 indexed sessionId, uint256 indexed tokenId, uint256 amount, uint256 daoCut)',
];

export const SPLIT_RESOLVER_ABI = [
  'function getSplits(uint256 tokenId) view returns (tuple(address recipient, uint256 basisPoints)[])',
  'function setSplits(uint256 tokenId, address[] recipients, uint256[] bps)',
  'function locked(uint256 tokenId) view returns (bool)',
];

export const FRACTIONAL_VAULT_FACTORY_ABI = [
  'function fractionalise(address nft, uint256 tokenId, address revenueToken, uint256 totalShares, string name, string symbol) returns (address)',
  'function vaultOf(address nft, uint256 tokenId) view returns (address)',
  'function allVaultsLength() view returns (uint256)',
];

/** Canonical deterministic-deployment address — live on Arc testnet (verified via eth_getCode). */
export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

export const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
];

export const FRACTIONAL_VAULT_ABI = [
  'function curator() view returns (address)',
  'function withdrawableRevenueOf(address holder) view returns (uint256)',
  'function claimRevenue() returns (uint256)',
  'function redeem()',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function saleSharePrice() view returns (uint256)',
  'function sharesForSale() view returns (uint256)',
  'function configureSale(uint256 shares, uint256 pricePerShare)',
  'function buyShares(uint256 shareAmount)',
];
