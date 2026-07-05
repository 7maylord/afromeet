'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import {
  ShoppingBag,
  Layers,
  Coins,
  Plus,
  Loader2,
  Lock,
  Settings,
  Tag,
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FRACTIONAL_VAULT_FACTORY_ADDRESS ?? '';
const NFT_ADDRESS = process.env.NEXT_PUBLIC_AFROMEET_NFT_ADDRESS ?? '';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000';

const VAULT_ABI = [
  'function buyShares(uint256 shareAmount)',
  'function claimRevenue() returns (uint256)',
  'function configureSale(uint256 shares, uint256 pricePerShare)',
  'function totalSupply() view returns (uint256)',
];
const USDC_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
const NFT_APPROVE_ABI = ['function approve(address to, uint256 tokenId)'];
const FACTORY_WRITE_ABI = [
  'function fractionalise(address nft, uint256 tokenId, address revenueToken, uint256 totalShares, string name, string symbol) returns (address)',
];

interface RawWork {
  id: string;
  creator: string;
  title: string;
  tokenURI: string;
  vault: string | null;
  sharePriceRaw: string;
  sharesForSale: number;
  totalShares: number;
}

interface MarketplaceItem {
  tokenId: string;
  title: string;
  creator: string;
  isFractionalized: boolean;
  vaultAddress?: string;
  availableShares?: number;
  sharePriceRaw?: bigint; // USDC (6dp) per share, from the vault
  totalShares?: number; // total supply of the vault
}

export default function MarketplacePanel() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [shareQty, setShareQty] = useState<Record<string, string>>({});

  // Configure Sale state – per-card inputs
  const [saleShares, setSaleShares] = useState<Record<string, string>>({});
  const [salePrice, setSalePrice] = useState<Record<string, string>>({});
  const [showSaleConfig, setShowSaleConfig] = useState<Record<string, boolean>>({});

  const setStatusMsg = (m: { type: 'success' | 'info' | 'error'; text: string } | null) => {
    if (!m) return;
    if (m.type === 'success') toast.success(m.text);
    else if (m.type === 'error') toast.error(m.text);
    else toast.info(m.text);
  };

  const [fractionalizeTokenId, setFractionalizeTokenId] = useState<string>('');
  const [totalShares, setTotalShares] = useState<string>('10000');
  const [vaultName, setVaultName] = useState<string>('');
  const [vaultSymbol, setVaultSymbol] = useState<string>('');
  const [isFractionalizing, setIsFractionalizing] = useState<boolean>(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const cat: RawWork[] = await fetch(`${BACKEND_URL}/access/catalogue`).then((r) => r.json());

      const mapped = (Array.isArray(cat) ? cat : []).map((w) => {
        const item: MarketplaceItem = {
          tokenId: w.id,
          title: w.title || `Work #${w.id}`,
          creator: w.creator,
          isFractionalized: Boolean(w.vault),
        };
        if (w.vault) {
          item.vaultAddress = w.vault;
          item.sharePriceRaw = BigInt(w.sharePriceRaw || '0');
          item.availableShares = w.sharesForSale;
          item.totalShares = w.totalShares;
        }
        return item;
      });
      setItems(mapped);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems();
  }, [loadItems]);

  async function getSigner() {
    const provider = new ethers.BrowserProvider(await wallets[0].getEthereumProvider());
    return provider.getSigner();
  }

  const handleBuyShares = async (item: MarketplaceItem) => {
    if (!authenticated || !wallets[0]) {
      setStatusMsg({ type: 'error', text: 'Please connect your wallet first.' });
      return;
    }
    if (!item.vaultAddress || item.sharePriceRaw === undefined) {
      setStatusMsg({ type: 'error', text: 'This work hasn\'t been fractionalized yet.' });
      return;
    }
    const qty = Math.max(1, parseInt(shareQty[item.tokenId] || '100', 10));
    if (item.availableShares !== undefined && qty > item.availableShares) {
      setStatusMsg({ type: 'error', text: `Only ${item.availableShares} shares left in this vault.` });
      return;
    }
    setLoading(true);
    setActionId(`share-${item.tokenId}`);
    try {
      const signer = await getSigner();
      const cost = BigInt(qty) * item.sharePriceRaw;

      setStatusMsg({ type: 'info', text: `Approving $${(Number(cost) / 1e6).toFixed(4)} USDC…` });
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      await (await usdc.approve(item.vaultAddress, cost)).wait();

      setStatusMsg({ type: 'info', text: `Buying ${qty} shares on Arc…` });
      const vault = new ethers.Contract(item.vaultAddress, VAULT_ABI, signer);
      const tx = await vault.buyShares(qty);
      await tx.wait();

      setStatusMsg({ type: 'success', text: `Bought ${qty} shares. You now earn pro-rata access revenue. Tx ${tx.hash.slice(0, 10)}…` });
      loadItems();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Share purchase failed: ${(err as Error).message?.slice(0, 120) || err}` });
    } finally {
      setLoading(false);
      setActionId(null);
    }
  };

  const handleClaimRevenue = async (item: MarketplaceItem) => {
    if (!authenticated || !wallets[0]) {
      setStatusMsg({ type: 'error', text: 'Please connect your wallet first.' });
      return;
    }
    if (!item.vaultAddress) {
      setStatusMsg({ type: 'error', text: 'This work hasn\'t been fractionalized yet.' });
      return;
    }
    setLoading(true);
    setActionId(`claim-${item.tokenId}`);
    setStatusMsg({ type: 'info', text: 'Claiming your accrued USDC revenue…' });
    try {
      const signer = await getSigner();
      const vault = new ethers.Contract(item.vaultAddress, VAULT_ABI, signer);
      const tx = await vault.claimRevenue();
      await tx.wait();
      setStatusMsg({ type: 'success', text: `Revenue claimed to your wallet. Tx ${tx.hash.slice(0, 10)}…` });
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Claim failed: ${(err as Error).message?.slice(0, 120) || err}` });
    } finally {
      setLoading(false);
      setActionId(null);
    }
  };

  const handleConfigureSale = async (item: MarketplaceItem) => {
    if (!authenticated || !wallets[0]) {
      setStatusMsg({ type: 'error', text: 'Please connect your wallet first.' });
      return;
    }
    if (!item.vaultAddress) {
      setStatusMsg({ type: 'error', text: 'This work hasn\'t been fractionalized yet.' });
      return;
    }
    const shares = parseInt(saleShares[item.tokenId] || '0', 10);
    const priceUsdc = parseFloat(salePrice[item.tokenId] || '0');
    if (shares <= 0) {
      setStatusMsg({ type: 'error', text: 'Enter the number of shares to list for sale.' });
      return;
    }
    if (priceUsdc <= 0) {
      setStatusMsg({ type: 'error', text: 'Set a price per share (in USDC).' });
      return;
    }
    // Convert USDC amount to 6-decimal raw value
    const priceRaw = BigInt(Math.round(priceUsdc * 1e6));
    setLoading(true);
    setActionId(`config-${item.tokenId}`);
    try {
      const signer = await getSigner();
      setStatusMsg({ type: 'info', text: `Configuring sale: ${shares} shares @ $${priceUsdc} each…` });
      const vault = new ethers.Contract(item.vaultAddress, VAULT_ABI, signer);
      const tx = await vault.configureSale(shares, priceRaw);
      await tx.wait();
      setStatusMsg({ type: 'success', text: `Sale configured! ${shares} shares now listed @ $${priceUsdc} USDC each. Tx ${tx.hash.slice(0, 10)}…` });
      setShowSaleConfig((s) => ({ ...s, [item.tokenId]: false }));
      loadItems();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Configure sale failed: ${(err as Error).message?.slice(0, 120) || err}` });
    } finally {
      setLoading(false);
      setActionId(null);
    }
  };

  const handleFractionalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authenticated || !wallets[0] || !fractionalizeTokenId) return;
    if (!FACTORY_ADDRESS || !NFT_ADDRESS) {
      setStatusMsg({ type: 'error', text: 'Factory/NFT address not configured.' });
      return;
    }
    setIsFractionalizing(true);
    try {
      const signer = await getSigner();

      setStatusMsg({ type: 'info', text: `Approving NFT #${fractionalizeTokenId} to the vault factory…` });
      const nft = new ethers.Contract(NFT_ADDRESS, NFT_APPROVE_ABI, signer);
      await (await nft.approve(FACTORY_ADDRESS, fractionalizeTokenId)).wait();

      setStatusMsg({ type: 'info', text: 'Deploying the fractional vault on Arc…' });
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_WRITE_ABI, signer);
      const tx = await factory.fractionalise(
        NFT_ADDRESS,
        fractionalizeTokenId,
        USDC_ADDRESS,
        BigInt(totalShares || '10000'),
        vaultName || `AfroMeet Work ${fractionalizeTokenId} Shares`,
        vaultSymbol || `AM${fractionalizeTokenId}`,
      );
      await tx.wait();

      setStatusMsg({ type: 'success', text: `Vault deployed — NFT #${fractionalizeTokenId} locked, ${totalShares} shares minted. Tx ${tx.hash.slice(0, 10)}…` });
      setFractionalizeTokenId('');
      setVaultName('');
      setVaultSymbol('');
      loadItems();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Fractionalize failed: ${(err as Error).message?.slice(0, 120) || err}` });
    } finally {
      setIsFractionalizing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Works Grid */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading catalogue from Arc…
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          No works on-chain yet. Mint one from the Studio tab to populate the market.
        </p>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.tokenId} className="glass rounded-xl p-5 border border-zinc-800/80 hover:border-kente-gold/30 transition-all flex flex-col justify-between min-h-[320px]">
              <div>
                <div className="bg-zinc-900 rounded-lg h-40 flex items-center justify-center border border-zinc-850 relative overflow-hidden mb-4">
                  <ShoppingBag className="w-12 h-12 text-zinc-700" />
                  <span className="absolute bottom-2 left-2 bg-zinc-950/80 border border-zinc-800 text-[10px] text-zinc-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Token #{item.tokenId}
                  </span>
                  {item.isFractionalized && (
                    <span className="absolute top-2 right-2 bg-purple-950/80 border border-purple-800 text-[10px] text-purple-300 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
                      <Layers className="w-3 h-3" /> Fractionalized
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-white text-base">{item.title}</h4>
                <p className="text-zinc-500 text-xs mt-1 truncate">
                  Creator: {item.creator.slice(0, 8)}…{item.creator.slice(-6)}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800/60 space-y-3">
                {item.isFractionalized && item.sharePriceRaw !== undefined ? (
                  <>
                    <div className="flex items-center justify-between text-xs bg-zinc-950/40 p-2 rounded border border-zinc-850">
                      <span className="text-zinc-500">Share price:</span>
                      <span className="font-mono text-amber-400 font-bold">
                        {item.sharePriceRaw > 0n
                          ? `$${(Number(item.sharePriceRaw) / 1e6).toFixed(4)} · ${item.availableShares} left`
                          : 'Not listed for sale yet'}
                      </span>
                    </div>

                    {/* Configure Sale toggle & inline form */}
                    {showSaleConfig[item.tokenId] ? (
                      <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3 space-y-2">
                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                          <Tag className="w-3 h-3 text-kente-gold" /> Configure Sale (curator only)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-zinc-500">Shares to sell</label>
                            <input
                              type="number"
                              min={1}
                              value={saleShares[item.tokenId] ?? ''}
                              onChange={(e) => setSaleShares((s) => ({ ...s, [item.tokenId]: e.target.value }))}
                              placeholder={`e.g. ${item.totalShares || 10000}`}
                              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2 text-white text-xs font-mono"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-zinc-500">Price / share (USDC)</label>
                            <input
                              type="number"
                              min={0.000001}
                              step={0.0001}
                              value={salePrice[item.tokenId] ?? ''}
                              onChange={(e) => setSalePrice((s) => ({ ...s, [item.tokenId]: e.target.value }))}
                              placeholder="e.g. 0.01"
                              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2 text-white text-xs font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfigureSale(item)}
                            disabled={loading && actionId === `config-${item.tokenId}`}
                            className="flex-1 bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-all"
                          >
                            {loading && actionId === `config-${item.tokenId}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Tag className="w-3.5 h-3.5" />
                            )}
                            List Shares
                          </button>
                          <button
                            onClick={() => setShowSaleConfig((s) => ({ ...s, [item.tokenId]: false }))}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-semibold py-2 px-3 rounded-lg text-xs transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSaleConfig((s) => ({ ...s, [item.tokenId]: true }))}
                        className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Settings className="w-3.5 h-3.5 text-kente-gold" />
                        {item.sharePriceRaw > 0n ? 'Reconfigure Sale' : 'Configure Sale'}
                      </button>
                    )}

                    {/* Buy shares — only show when a sale is active */}
                    {item.sharePriceRaw > 0n && (item.availableShares ?? 0) > 0 && (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          value={shareQty[item.tokenId] ?? '100'}
                          onChange={(e) => setShareQty((q) => ({ ...q, [item.tokenId]: e.target.value }))}
                          className="w-20 bg-zinc-900 border border-zinc-850 rounded-lg p-2 text-white text-xs font-mono"
                          aria-label="Shares to buy"
                        />
                        <button
                          onClick={() => handleBuyShares(item)}
                          disabled={loading && actionId === `share-${item.tokenId}`}
                          className="flex-1 bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-all"
                        >
                          {loading && actionId === `share-${item.tokenId}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Layers className="w-3.5 h-3.5" />
                          )}
                          Buy Shares
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => handleClaimRevenue(item)}
                      disabled={loading && actionId === `claim-${item.tokenId}`}
                      className="w-full bg-emerald-950 hover:bg-emerald-900 border border-emerald-900/50 text-emerald-400 font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-all"
                    >
                      {loading && actionId === `claim-${item.tokenId}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      ) : (
                        <Coins className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      Claim Vault Revenue
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-600 py-2">
                    <Lock className="w-3.5 h-3.5" /> Not fractionalized yet
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fractionalize Form */}
      <div className="glass rounded-xl p-6 border border-zinc-800 max-w-lg mx-auto">
        <h4 className="font-bold text-white text-base flex items-center gap-2 border-b border-zinc-800 pb-3 mb-4">
          <Layers className="w-5 h-5 text-kente-gold" /> Fractionalize Your Work
        </h4>

        <form onSubmit={handleFractionalize} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-zinc-500">Token ID *</label>
              <input
                type="number"
                value={fractionalizeTokenId}
                onChange={(e) => setFractionalizeTokenId(e.target.value)}
                placeholder="e.g. 2"
                className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-500">Total Share Supply</label>
              <input
                type="number"
                value={totalShares}
                onChange={(e) => setTotalShares(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 text-white font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-zinc-500">Vault Name</label>
              <input
                type="text"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                placeholder="e.g. Tales of Anansi Shares"
                className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-500">Vault Symbol</label>
              <input
                type="text"
                value={vaultSymbol}
                onChange={(e) => setVaultSymbol(e.target.value)}
                placeholder="e.g. ANANSI"
                className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isFractionalizing || !fractionalizeTokenId}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 rounded-lg border border-zinc-700 transition-all flex items-center justify-center gap-1.5"
          >
            {isFractionalizing ? (
              <Loader2 className="w-4 h-4 animate-spin text-kente-gold" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Deploy Vault &amp; Fractionalize
          </button>
        </form>
      </div>
    </div>
  );
}
