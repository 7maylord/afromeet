'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import { 
  Play, 
  Pause, 
  Square, 
  Lock, 
  Unlock, 
  Music, 
  Film, 
  BookOpen, 
  Image as ImageIcon,
  Coins,
  Loader2
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000';
const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ACCESS_ESCROW_ADDRESS ?? '';
const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs/';

const hexToBytes = (h: string) => new Uint8Array((h.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)));

/** Decrypt an AES-256-GCM ciphertext (key released only after payment) → blob URL or text. */
async function decryptGatedContent(c: {
  cipherUrl: string;
  key: string;
  iv: string;
  mediaType: string;
}): Promise<{ url?: string; text?: string }> {
  const cryptoKey = await crypto.subtle.importKey('raw', hexToBytes(c.key), 'AES-GCM', false, ['decrypt']);
  const cipher = await fetch(c.cipherUrl).then((r) => r.arrayBuffer());
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(c.iv) }, cryptoKey, cipher);
  if (c.mediaType.startsWith('text') || c.mediaType.includes('json')) {
    return { text: new TextDecoder().decode(plain) };
  }
  return { url: URL.createObjectURL(new Blob([plain], { type: c.mediaType })) };
}

interface WorkItem {
  id: string;
  title: string;
  creator: string;
  category: string;
  price: number;
  discoveryPrice: number;
  ratePerSecondUsdc?: number; // TIMED nanopayment rate (fallback if not on-chain yet)
  mode: 'TIMED' | 'DISCRETE';
  minAccessSeconds: number;
  url?: string;
  content?: string;
}

const DEFAULT_WORKS: WorkItem[] = [
  {
    id: '1',
    title: 'Lagos Grooves & Rhythms',
    creator: '0xef0ee06ebfb7536dfce6db0c83aa460ef3ed8322', // NFT Contract Address
    category: 'music',
    price: 0.001,
    discoveryPrice: 0.002,
    ratePerSecondUsdc: 0.0001,
    mode: 'TIMED',
    minAccessSeconds: 30,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  {
    id: '2',
    title: 'Tales of Anansi (Spider Wisdom)',
    creator: '0xad6433f3a49eb065e6470f231a3dc3dee26f0f9d',
    category: 'writing',
    price: 0.001,
    discoveryPrice: 0.001,
    mode: 'DISCRETE',
    minAccessSeconds: 0,
    content: `In the golden kingdom of the Ashanti, wisdom was once kept in a clay pot. Anansi, the clever trickster spider, wanted to hoard all of it for himself. He climbed the highest baobab tree, strapping the pot to his belly. 

However, his son Ntikuma noticed his struggle. "Father, if you tie the pot to your back instead, it will be easier to climb," he called out. 

Anansi realized his son was right. Angered that a child possessed wisdom he had not yet hoarded, Anansi dropped the pot. It shattered into a million pieces, scattering wisdom across the earth for all to share. Since then, wisdom has belonged to everyone, not just one person.`
  },
  {
    id: '3',
    title: 'Egungun Masquerade Art',
    creator: '0xf99337df8acbdce3221372ea41610d38b54ca33f', // Agent Address
    category: 'art',
    price: 0.0005,
    discoveryPrice: 0.0005,
    mode: 'DISCRETE',
    minAccessSeconds: 0,
    url: '/logo.png'
  }
];

export default function MediaPlayer() {
  const { user, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [works, setWorks] = useState<WorkItem[]>(DEFAULT_WORKS);
  const [selectedWork, setSelectedWork] = useState<WorkItem>(DEFAULT_WORKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [rateUsdc, setRateUsdc] = useState<number>(0.0001); // per-second rate (from on-chain config)
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null); // gated audio after decrypt
  const [approved, setApproved] = useState<boolean>(false); // listener has approved USDC to escrow
  const [approving, setApproving] = useState<boolean>(false);

  // Listener approves the escrow to pull USDC, so per-second settlement can actually clear.
  const handleApproveUsdc = async () => {
    if (!wallets[0]) {
      setStatusMsg({ type: 'error', text: 'Connect a wallet first.' });
      return;
    }
    setApproving(true);
    setStatusMsg({ type: 'info', text: 'Approving USDC for per-second streaming…' });
    try {
      const provider = new ethers.BrowserProvider(await wallets[0].getEthereumProvider());
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(
        USDC_ADDRESS,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        signer,
      );
      const tx = await usdc.approve(ESCROW_ADDRESS, ethers.MaxUint256);
      await tx.wait();
      setApproved(true);
      setStatusMsg({ type: 'success', text: 'USDC enabled — the escrow can now meter your playback per second.' });
    } catch {
      setStatusMsg({ type: 'error', text: 'USDC approval failed.' });
    } finally {
      setApproving(false);
    }
  };
  
  // Discrete unlock state
  const [unlockedContents, setUnlockedContents] = useState<Record<string, { content?: string; url?: string }>>({});
  
  const setStatusMsg = (m: { type: 'success' | 'info' | 'error'; text: string } | null) => {
    if (!m) return;
    if (m.type === 'success') toast.success(m.text);
    else if (m.type === 'error') toast.error(m.text);
    else toast.info(m.text);
  };
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Timed session handler
  const handlePlayToggle = async () => {
    if (selectedWork.mode === 'DISCRETE') return;

    if (isPlaying) {
      // Stopping the playback
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) audioRef.current.pause();

      if (currentTime >= selectedWork.minAccessSeconds && sessionId) {
        setLoading(true);
        setStatusMsg({ type: 'info', text: 'Settling timed access session on Arc...' });
        try {
          const res = await fetch(`${BACKEND_URL}/access/session/settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, elapsedSeconds: currentTime })
          }).then(r => r.json());

          setStatusMsg({
            type: 'success',
            text: `Settled ${currentTime}s × $${rateUsdc}/s = $${(currentTime * rateUsdc).toFixed(6)} USDC on Arc. Tx: ${res.txHash.slice(0, 10)}...${res.txHash.slice(-8)}`
          });
        } catch (err) {
          setStatusMsg({ type: 'error', text: 'Settlement transaction failed on-chain.' });
        } finally {
          setLoading(false);
          setSessionId(null);
          setCurrentTime(0);
        }
      } else {
        setStatusMsg({
          type: 'info',
          text: `Session closed early (${currentTime}s / ${selectedWork.minAccessSeconds}s required). No USDC settled.`
        });
        setSessionId(null);
        setCurrentTime(0);
      }
    } else {
      // Start Playback -> Open session first
      if (!authenticated) {
        setStatusMsg({ type: 'error', text: 'Please connect your wallet first.' });
        return;
      }
      setLoading(true);
      setStatusMsg({ type: 'info', text: 'Initializing payment session on Arc...' });
      try {
        const res = await fetch(`${BACKEND_URL}/access/session/open`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenId: selectedWork.id,
            listener: user?.wallet?.address,
            // Pre-authorise a session budget (~10 min of playback) — the contract caps to this.
            authorisedUsdc: Math.max(0.1, rateUsdc * 600)
          })
        }).then(r => r.json());

        setSessionId(res.sessionId);

        // Release + decrypt the gated master for this open session (no double-charge).
        try {
          const gated = await fetch(`${BACKEND_URL}/access/session/${res.sessionId}/content`).then(r => r.json());
          const src = gated.encrypted ? (await decryptGatedContent(gated)).url : gated.url;
          if (src) {
            setDecryptedUrl(src);
            if (audioRef.current) audioRef.current.src = src;
          }
        } catch {
          /* fall back to any public src on the element */
        }

        setIsPlaying(true);
        setStatusMsg({ type: 'info', text: 'Session opened — streaming, metered per second.' });

        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => undefined);
        }

        timerRef.current = setInterval(() => {
          setCurrentTime(prev => {
            const next = prev + 1;
            // Trigger auto-settlement check or simple progress
            return next;
          });
        }, 1000);
      } catch (err) {
        setStatusMsg({ type: 'error', text: 'Could not open escrow session. Check backend status.' });
      } finally {
        setLoading(false);
      }
    }
  };

  // Discrete unlock: pay the x402 discovery nanopayment, then decrypt the released master.
  const handleDiscreteUnlock = async () => {
    if (!authenticated || !wallets[0]) {
      setStatusMsg({ type: 'error', text: 'Please connect your wallet first.' });
      return;
    }
    setLoading(true);
    try {
      // 1. Pay the discovery price directly to the creator (real USDC transfer).
      const cfg = await fetch(`${BACKEND_URL}/access/config/${selectedWork.id}`).then((r) => r.json());
      const priceRaw = BigInt(cfg.discoveryPrice || '0');
      let txHash = '';
      if (priceRaw > BigInt(0)) {
        setStatusMsg({ type: 'info', text: 'Paying discovery nanopayment in USDC…' });
        const provider = new ethers.BrowserProvider(await wallets[0].getEthereumProvider());
        const signer = await provider.getSigner();
        const usdc = new ethers.Contract(
          USDC_ADDRESS,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          signer,
        );
        const tx = await usdc.transfer(cfg.creator, priceRaw);
        await tx.wait();
        txHash = tx.hash;
      }

      // 2. Fetch the gated content — the backend releases the key only if the payment verifies.
      setStatusMsg({ type: 'info', text: 'Unlocking & decrypting content…' });
      const res = await fetch(`${BACKEND_URL}/access/${selectedWork.id}`, {
        headers: txHash ? { 'X-Payment-Tx': txHash } : {},
      });
      if (!res.ok) throw new Error('Payment not verified by the x402 gate');
      const content = await res.json();

      // 3. Decrypt locally (key released post-payment) and render.
      let unlocked: { content?: string; url?: string } = {};
      if (content.encrypted) {
        const dec = await decryptGatedContent(content);
        unlocked = { url: dec.url, content: dec.text };
      } else {
        unlocked = { url: content.url };
      }
      setUnlockedContents((prev) => ({ ...prev, [selectedWork.id]: unlocked }));
      setStatusMsg({ type: 'success', text: `Unlocked "${selectedWork.title}" — decrypted from IPFS.` });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: `Unlock failed: ${(err as Error).message || err}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset state on work change (intentional — a new work starts a fresh session).
    /* eslint-disable react-hooks/set-state-in-effect */
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrentTime(0);
    setSessionId(null);
    setStatusMsg(null);
    setDecryptedUrl(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Pull the live on-chain config (real per-second rate) + the listener's USDC allowance.
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetch(`${BACKEND_URL}/access/config/${selectedWork.id}`).then((r) => r.json());
        if (cancelled) return;
        const onchainRate = Number(cfg.ratePerSecond) / 1e6;
        setRateUsdc(onchainRate > 0 ? onchainRate : selectedWork.ratePerSecondUsdc ?? 0.0001);
      } catch {
        if (!cancelled) setRateUsdc(selectedWork.ratePerSecondUsdc ?? 0.0001);
      }

      if (selectedWork.mode === 'TIMED' && user?.wallet?.address && wallets[0]) {
        try {
          const bp = new ethers.BrowserProvider(await wallets[0].getEthereumProvider());
          const usdc = new ethers.Contract(
            USDC_ADDRESS,
            ['function allowance(address owner, address spender) view returns (uint256)'],
            bp,
          );
          const a: bigint = await usdc.allowance(user.wallet.address, ESCROW_ADDRESS);
          if (!cancelled) setApproved(a > BigInt(0));
        } catch {
          /* leave approved as-is */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedWork, user?.wallet?.address]);

  // Load the real on-chain catalogue once; fall back to the seed works if empty/unavailable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cat = await fetch(`${BACKEND_URL}/access/catalogue`).then((r) => r.json());
        if (cancelled || !Array.isArray(cat) || cat.length === 0) return;
        const mapped: WorkItem[] = await Promise.all(
          cat.map(async (w: Record<string, unknown>) => {
            let meta: Record<string, unknown> | null = null;
            try {
              const uri = String(w.tokenURI ?? '');
              const url = uri.startsWith('ipfs://') ? IPFS_GATEWAY + uri.slice(7) : uri;
              if (url) meta = await fetch(url).then((r) => r.json()).catch(() => null);
            } catch {
              /* unresolved metadata — fall back below */
            }
            const mode = w.mode as 'TIMED' | 'DISCRETE';
            return {
              id: String(w.id),
              title: (meta?.title as string) ?? (meta?.name as string) ?? `Work #${w.id}`,
              creator: String(w.creator),
              category: (meta?.category as string) ?? (mode === 'TIMED' ? 'music' : 'art'),
              price: Number(w.pricePerAccessUsdc),
              discoveryPrice: Number(w.discoveryPriceUsdc),
              ratePerSecondUsdc: Number(w.ratePerSecondUsdc),
              mode,
              minAccessSeconds: Number(w.minAccessSeconds),
              url: (meta?.url as string) ?? (meta?.animation_url as string) ?? (meta?.image as string),
              content: meta?.content as string,
            } as WorkItem;
          }),
        );
        if (!cancelled) {
          setWorks(mapped);
          setSelectedWork(mapped[0]);
        }
      } catch {
        /* keep seed works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const renderIcon = (cat: string) => {
    switch (cat) {
      case 'music': return <Music className="w-5 h-5 text-purple-400" />;
      case 'film': return <Film className="w-5 h-5 text-emerald-400" />;
      case 'writing': return <BookOpen className="w-5 h-5 text-amber-400" />;
      default: return <ImageIcon className="w-5 h-5 text-blue-400" />;
    }
  };

  const isUnlocked = selectedWork.mode === 'TIMED' || unlockedContents[selectedWork.id];

  return (
    <div className="grid md:grid-cols-3 gap-8">
      {/* Playback controller */}
      {(selectedWork.category === 'music' || selectedWork.mode === 'TIMED') && (
        <audio ref={audioRef} src={decryptedUrl ?? selectedWork.url ?? undefined} className="hidden" />
      )}

      {/* Works List */}
      <div className="md:col-span-1 space-y-4">
        <h3 className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Catalogue</h3>
        <div className="space-y-3">
          {works.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedWork(w)}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                selectedWork.id === w.id 
                  ? 'bg-kente-purple/20 border-kente-gold shadow-md' 
                  : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                {renderIcon(w.category)}
                <div className="truncate">
                  <h4 className="font-bold text-white text-sm truncate">{w.title}</h4>
                  <p className="text-zinc-500 text-xs truncate">By {w.creator.slice(0, 6)}...{w.creator.slice(-4)}</p>
                </div>
              </div>
              
              <div className="text-right">
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-medium uppercase tracking-wider block mb-1">
                  {w.mode}
                </span>
                <span className="font-mono text-xs text-white font-semibold">
                  ${w.price}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Player Screen */}
      <div className="md:col-span-2 space-y-6">
        <div className="glass rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[360px] border border-zinc-800/60">
          <div className="absolute inset-0 bg-kente-texture opacity-[0.02] pointer-events-none"></div>

          {/* Top Bar info */}
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 z-10">
            <div className="flex items-center gap-2">
              {renderIcon(selectedWork.category)}
              <h3 className="font-bold text-white">{selectedWork.title}</h3>
            </div>
            {isUnlocked ? (
              <span className="flex items-center gap-1 text-emerald-400 text-xs bg-emerald-950/60 border border-emerald-900/80 px-2.5 py-1 rounded-full font-semibold">
                <Unlock className="w-3 h-3" /> UNLOCKED
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500 text-xs bg-amber-950/60 border border-amber-900/80 px-2.5 py-1 rounded-full font-semibold">
                <Lock className="w-3 h-3" /> LOCKED
              </span>
            )}
          </div>

          {/* Center Screen */}
          <div className="flex-1 flex flex-col items-center justify-center py-8 z-10">
            {selectedWork.mode === 'TIMED' ? (
              // Timed Media Screen (Heartbeat visual)
              <div className="text-center space-y-4">
                <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto border-2 ${
                  isPlaying ? 'border-kente-gold pulse-gold bg-kente-purple/10' : 'border-zinc-800 bg-zinc-900/30'
                }`}>
                  <span className="font-mono text-2xl font-bold text-white">
                    {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <span className="text-zinc-500 text-xs uppercase tracking-wider block">
                    Access Escrow Session
                  </span>
                  <p className="font-mono text-zinc-300 text-xs bg-zinc-950/50 px-3 py-1.5 rounded border border-zinc-850 truncate max-w-sm mx-auto">
                    {sessionId ? `Session ID: ${sessionId.slice(0, 16)}...` : 'Inactive'}
                  </p>
                </div>
                
                {isPlaying && (
                  <div className="flex flex-col items-center gap-1 text-zinc-400 text-xs">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-kente-gold" />
                      <span>Accumulating: </span>
                      <span className="font-mono text-white font-bold">
                        ${(currentTime * rateUsdc).toFixed(6)} USDC
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      per-second nanopayment · ${rateUsdc}/s · pay for exactly what you hear
                    </span>
                  </div>
                )}
              </div>
            ) : (
              // Discrete Screen (Unlocked content rendering)
              <div className="w-full flex-1 flex flex-col items-center justify-center">
                {isUnlocked ? (
                  selectedWork.category === 'writing' ? (
                    <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 text-zinc-300 text-sm leading-relaxed max-h-[220px] overflow-y-auto">
                      <p className="whitespace-pre-line">{unlockedContents[selectedWork.id]?.content || selectedWork.content}</p>
                    </div>
                  ) : (
                    <div className="relative w-48 h-48 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
                      <Image 
                        src="/logo.png" 
                        alt="Unlocked Art"
                        fill
                        className="object-contain p-4"
                      />
                    </div>
                  )
                ) : (
                  // Locked Screen
                  <div className="text-center space-y-4 max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-white text-base">Discrete Access Locked</h4>
                      <p className="text-zinc-500 text-xs">
                        This creative work is protected by the x402 payment protocol. Pay once to pull full content from IPFS.
                      </p>
                    </div>
                    
                    <button
                      onClick={handleDiscreteUnlock}
                      disabled={loading}
                      className="bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold px-6 py-2.5 rounded-full text-sm inline-flex items-center gap-1.5 transition-all shadow-md"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Coins className="w-4 h-4" />
                      )}
                      Unlock for ${selectedWork.discoveryPrice} USDC
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Control Bar */}
          <div className="border-t border-zinc-800/60 pt-4 flex items-center justify-between z-10">
            {selectedWork.mode === 'TIMED' ? (
              !approved ? (
              <button
                onClick={handleApproveUsdc}
                disabled={approving}
                className="bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold px-5 py-2.5 rounded-full text-sm inline-flex items-center gap-1.5 transition-all shadow-md"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                Enable per-second payments
              </button>
              ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlayToggle}
                  disabled={loading}
                  className={`p-3 rounded-full transition-all ${
                    isPlaying 
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                      : 'bg-kente-gold hover:bg-kente-gold-light text-zinc-950'
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>
                
                {isPlaying && (
                  <button
                    onClick={handlePlayToggle}
                    className="p-3 bg-red-950 border border-red-900 text-red-400 rounded-full hover:bg-red-900 hover:text-white transition-all animate-pulse"
                    title="Stop and Settle Session"
                  >
                    <Square className="w-5 h-5 fill-current" />
                  </button>
                )}
              </div>
              )
            ) : (
              <div className="text-zinc-500 text-xs">
                Discrete access remains unlocked forever once purchased.
              </div>
            )}

            <div className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span>Threshold:</span>
              <span className="font-mono text-zinc-300">
                {selectedWork.minAccessSeconds > 0 ? `${selectedWork.minAccessSeconds}s min` : 'None (One-off)'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
