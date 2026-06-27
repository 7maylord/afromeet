'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useRef, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
  Upload, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  HelpCircle,
  Percent
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const AFROMEET_NFT_ADDRESS = process.env.NEXT_PUBLIC_AFROMEET_NFT_ADDRESS || '0x9A8c6Df48613265Ea2b90f1e4Dd85eC3Ca9A85DE';
const SPLIT_RESOLVER_ADDRESS = process.env.NEXT_PUBLIC_SPLIT_RESOLVER_ADDRESS || '0x4cdd345EEFbfFE00F004C64Fe72da6EC667f8852';
const ACCESS_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_ACCESS_REGISTRY_ADDRESS || '0x5363eACF9b04CAfcD1DDb0dc5365532644A1B46A';

interface SplitRecipient {
  address: string;
  bps: number; // basis points (100 = 1%)
}

export default function MintForm() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('music');
  const [price, setPrice] = useState('0.001');
  const [discoveryPrice, setDiscoveryPrice] = useState('0.002');
  const [mode, setMode] = useState<'TIMED' | 'DISCRETE'>('TIMED');
  const [minAccessSeconds, setMinAccessSeconds] = useState(30);
  
  // Splits state
  const [splits, setSplits] = useState<SplitRecipient[]>([
    { address: '', bps: 10000 } // Default 100% to creator
  ]);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'minting' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default the first royalty split to the connected wallet (100%), so a solo creator types
  // nothing — they only add rows/addresses to share revenue with collaborators.
  const connectedAddress = wallets[0]?.address;
  useEffect(() => {
    if (!connectedAddress) return;
    setSplits((prev) =>
      prev.length > 0 && prev[0].address === ''
        ? [{ ...prev[0], address: connectedAddress }, ...prev.slice(1)]
        : prev,
    );
  }, [connectedAddress]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const addSplit = () => {
    setSplits(prev => [...prev, { address: '', bps: 0 }]);
  };

  const removeSplit = (index: number) => {
    setSplits(prev => prev.filter((_, i) => i !== index));
  };

  const updateSplit = (index: number, field: keyof SplitRecipient, value: string | number) => {
    setSplits(prev => prev.map((s, i) => {
      if (i === index) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const totalBps = splits.reduce((acc, curr) => acc + curr.bps, 0);

  const isFormValid = () => {
    return (
      title.trim() !== '' &&
      file !== null &&
      totalBps === 10000 &&
      splits.every(s => ethers.isAddress(s.address) && s.bps > 0)
    );
  };

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    if (!authenticated || wallets.length === 0) {
      setStatus('error');
      setMsg('Please connect your wallet first.');
      return;
    }

    setLoading(true);
    setStatus('uploading');
    setMsg('Pinning asset + metadata to IPFS...');

    try {
      // 1. Upload media + metadata via the backend (Pinata proxy) → tokenURI.
      const form = new FormData();
      form.append('file', file as File);
      form.append('title', title);
      form.append('description', description);
      form.append('category', category);
      const up = await fetch(`${BACKEND_URL}/works/upload`, { method: 'POST', body: form }).then((r) => r.json());
      if (!up?.metadataUri) throw new Error(up?.message || 'IPFS upload failed');

      setStatus('minting');
      setMsg('Minting work NFT on Arc...');

      const provider = new ethers.BrowserProvider(await wallets[0].getEthereumProvider());
      const signer = await provider.getSigner();
      const creatorAddr = await signer.getAddress();

      // 2. Mint the work NFT and read the tokenId from the Transfer event.
      const nft = new ethers.Contract(
        AFROMEET_NFT_ADDRESS,
        ['function mintWork(string uri) returns (uint256)'],
        signer,
      );
      const mintTx = await nft.mintWork(up.metadataUri);
      setMsg(`Mint tx ${mintTx.hash.slice(0, 10)}… confirming.`);
      const receipt = await mintTx.wait();

      const iface = new ethers.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
      ]);
      let tokenId: bigint | undefined;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== AFROMEET_NFT_ADDRESS.toLowerCase()) continue;
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'Transfer') {
            tokenId = parsed.args.tokenId as bigint;
            break;
          }
        } catch {
          /* not a Transfer log */
        }
      }
      if (tokenId === undefined) throw new Error('Could not read minted tokenId');

      // Bind the encrypted upload's key to the freshly-minted tokenId (gated media).
      await fetch(`${BACKEND_URL}/works/${tokenId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: up.uploadId }),
      }).catch(() => undefined);

      // 3. Configure access — per-second rate for TIMED, flat unlock price for DISCRETE.
      setMsg(`Configuring access for work #${tokenId}…`);
      const toRaw = (v: string) => ethers.parseUnits(v || '0', 6);
      const isTimed = mode === 'TIMED';
      const registry = new ethers.Contract(
        ACCESS_REGISTRY_ADDRESS,
        ['function setConfig(uint256 tokenId, uint256 pricePerAccess, uint256 discoveryPrice, uint256 ratePerSecond, uint8 mode, uint256 minAccessSeconds)'],
        signer,
      );
      await (
        await registry.setConfig(
          tokenId,
          isTimed ? 0 : toRaw(price), // pricePerAccess (DISCRETE flat)
          toRaw(discoveryPrice), // discoveryPrice
          isTimed ? toRaw(price) : 0, // ratePerSecond (TIMED)
          isTimed ? 0 : 1, // mode enum
          minAccessSeconds,
        )
      ).wait();

      // 4. Set royalty splits (must sum to 10000; falls back to the creator for blank rows).
      setMsg(`Setting royalty splits for work #${tokenId}…`);
      const resolver = new ethers.Contract(
        SPLIT_RESOLVER_ADDRESS,
        ['function setSplits(uint256 tokenId, address[] recipients, uint256[] bps)'],
        signer,
      );
      await (
        await resolver.setSplits(
          tokenId,
          splits.map((s) => s.address || creatorAddr),
          splits.map((s) => s.bps),
        )
      ).wait();

      setStatus('success');
      setMsg(`Work #${tokenId} is live on AfroMeet — it now appears in the catalogue.`);
      setTitle('');
      setDescription('');
      setFile(null);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMsg(`Mint failed: ${(err as Error).message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto glass rounded-2xl p-6 border border-zinc-800 relative overflow-hidden">
      <div className="absolute inset-0 bg-kente-texture opacity-[0.02] pointer-events-none"></div>

      <div className="border-b border-zinc-800 pb-4 mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          🎨 Creator Studio
        </h3>
        <p className="text-zinc-500 text-xs mt-1">
          Mint your music, films, articles, or artwork as Web3 access-licensed NFTs.
        </p>
      </div>

      <form onSubmit={handleMint} className="space-y-6 relative z-10 text-sm">
        {/* File Upload */}
        <div className="space-y-2">
          <label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">
            Upload Work Asset *
          </label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-zinc-800 hover:border-kente-gold/50 rounded-xl p-8 text-center cursor-pointer transition-all bg-zinc-900/30"
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden" 
            />
            {file ? (
              <div className="space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="font-bold text-white text-sm">{file.name}</p>
                <p className="text-zinc-500 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-zinc-300 text-sm">Click to select asset file</p>
                <p className="text-zinc-500 text-xs">Supports MP3, MP4, JPEG, PNG, TXT, PDF</p>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lagos Sunset Mix"
            className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-3 text-white focus:outline-none focus:border-kente-gold transition-all"
            required
          />
        </div>

        {/* Medium Selection & Access Mode */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">
              Medium Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-3 text-white focus:outline-none"
            >
              <option value="music">Music / Audio</option>
              <option value="film">Video / Film</option>
              <option value="writing">Books / Writing</option>
              <option value="art">Painting / Visual Art</option>
              <option value="photography">Photography</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">
              Access Mode
            </label>
            <select
              value={mode}
              onChange={(e) => {
                const m = e.target.value as 'TIMED' | 'DISCRETE';
                setMode(m);
                if (m === 'DISCRETE') setMinAccessSeconds(0);
                else setMinAccessSeconds(30);
              }}
              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-3 text-white focus:outline-none"
            >
              <option value="TIMED">Timed (per play)</option>
              <option value="DISCRETE">Discrete (one-off unlock)</option>
            </select>
          </div>
        </div>

        {/* Pricing details */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">
              {mode === 'TIMED' ? 'Rate / Second (USDC)' : 'Unlock Price (USDC)'}
            </label>
            <input
              type="number"
              step="0.0001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-3 text-white font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">
              Discovery Price (USDC)
            </label>
            <input
              type="number"
              step="0.0001"
              value={discoveryPrice}
              onChange={(e) => setDiscoveryPrice(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-3 text-white font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">
              Min Duration (sec)
            </label>
            <input
              type="number"
              value={minAccessSeconds}
              onChange={(e) => setMinAccessSeconds(parseInt(e.target.value) || 0)}
              disabled={mode === 'DISCRETE'}
              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-3 text-white font-mono disabled:opacity-50"
            />
          </div>
        </div>

        {/* Dynamic Splits Configuration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
              Royalty Splits (Basis Points) 
              <span className="text-[10px] text-zinc-500 capitalize tracking-normal">(Sum must be 10,000 / 100%)</span>
            </label>
            <button
              type="button"
              onClick={addSplit}
              className="text-kente-gold hover:text-kente-gold-light text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Payee
            </button>
          </div>

          <div className="space-y-2">
            {splits.map((s, index) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Wallet Address (0x...)"
                  value={s.address}
                  onChange={(e) => updateSplit(index, 'address', e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none"
                  required
                />
                
                <div className="relative w-28">
                  <input
                    type="number"
                    placeholder="BPS (e.g. 5000)"
                    value={s.bps || ''}
                    onChange={(e) => updateSplit(index, 'bps', parseInt(e.target.value) || 0)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 pr-8 text-white font-mono text-xs text-right focus:outline-none"
                    required
                  />
                  <span className="absolute inset-y-0 right-2 flex items-center text-zinc-500 text-xs">
                    %
                  </span>
                </div>

                {splits.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSplit(index)}
                    className="p-2 hover:text-red-400 text-zinc-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Splits Status Info */}
          <div className="flex items-center justify-between bg-zinc-950/60 p-3 rounded-lg border border-zinc-850 text-xs">
            <span className="text-zinc-500">
              Total Allocation: <span className={`font-mono font-bold ${totalBps === 10000 ? 'text-emerald-400' : 'text-amber-500'}`}>{totalBps / 100}%</span>
            </span>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-kente-gold" />
              1% is auto-routed to Creator DAO
            </span>
          </div>
        </div>

        {/* Feedback Messages */}
        {status !== 'idle' && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
            status === 'success' 
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
              : status === 'error'
              ? 'bg-red-950/60 border-red-800/60 text-red-300'
              : 'bg-zinc-900/80 border-zinc-800/80 text-zinc-300'
          }`}>
            <span className="mt-0.5">
              {status === 'success' && <CheckCircle className="w-4.5 h-4.5 text-emerald-400" />}
              {status === 'error' && <AlertCircle className="w-4.5 h-4.5 text-red-400" />}
              {(status === 'uploading' || status === 'minting') && <Loader2 className="w-4.5 h-4.5 text-kente-gold animate-spin" />}
            </span>
            <p className="leading-relaxed">{msg}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid() || loading}
          className="w-full bg-gradient-to-r from-purple-700 to-kente-gold hover:from-purple-600 hover:to-kente-gold-light text-zinc-950 font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-kente-gold/20 disabled:opacity-50 disabled:cursor-not-allowed text-center uppercase tracking-wider"
        >
          {loading ? 'Processing work...' : 'Mint Creative Work NFT'}
        </button>
      </form>
    </div>
  );
}
