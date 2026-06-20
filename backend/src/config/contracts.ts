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
  'function mintWork(string uri) returns (uint256)',
];

export const ACCESS_REGISTRY_ABI = [
  'function getConfig(uint256 tokenId) view returns (tuple(uint256 pricePerAccess, uint256 discoveryPrice, uint8 mode, uint256 minAccessSeconds, address daoTreasury, bool active))',
  'function setConfig(uint256 tokenId, uint256 pricePerAccess, uint256 discoveryPrice, uint8 mode, uint256 minAccessSeconds)',
];

export const ACCESS_ESCROW_ABI = [
  'function openSession(bytes32 sessionId, address listener, uint256 tokenId, uint256 authorisedAmount)',
  'function settle(bytes32 sessionId)',
  'function sessions(bytes32 sessionId) view returns (address listener, uint256 tokenId, uint256 authorisedAmount, bool settled)',
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

export const FRACTIONAL_VAULT_ABI = [
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
