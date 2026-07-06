'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import AfroMeetHeader from '@/components/afromeet-header';
import {
  ArrowLeft,
  Loader2,
  Music,
  Film,
  BookOpen,
  Image as ImageIcon,
  Lock,
  Layers,
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

interface WorkItem {
  id: string;
  title: string;
  creator: string;
  category: string;
  price: number;
  discoveryPrice: number;
  ratePerSecondUsdc: number;
  mode: 'TIMED' | 'DISCRETE';
  minAccessSeconds: number;
  vault: string | null;
  totalShares: number;
}
type CatalogueWork = Record<string, string | number | null>;

export default function CataloguePage() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/');
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalogue() {
      try {
        const cat = await fetch(`${BACKEND_URL}/access/catalogue`).then((r) => r.json());
        if (cancelled) return;
        if (Array.isArray(cat)) {
          const mapped: WorkItem[] = (cat as CatalogueWork[]).map((w) => ({
            id: String(w.id),
            title: String(w.title || `Work #${w.id}`),
            creator: String(w.creator),
            category: String(w.category || (w.mode === 'TIMED' ? 'music' : 'art')),
            price: Number(w.pricePerAccessUsdc || 0),
            discoveryPrice: Number(w.discoveryPriceUsdc || 0),
            ratePerSecondUsdc: Number(w.ratePerSecondUsdc || 0),
            mode: w.mode as 'TIMED' | 'DISCRETE',
            minAccessSeconds: Number(w.minAccessSeconds || 0),
            vault: w.vault ? String(w.vault) : null,
            totalShares: Number(w.totalShares || 0),
          }));
          setWorks(mapped);
        }
      } catch (err) {
        console.error('Failed to load catalogue:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (authenticated) {
      loadCatalogue();
    }
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const renderIcon = (cat: string) => {
    switch (cat) {
      case 'music':
        return <Music className="w-5 h-5 text-purple-400" />;
      case 'film':
        return <Film className="w-5 h-5 text-emerald-400" />;
      case 'writing':
        return <BookOpen className="w-5 h-5 text-amber-400" />;
      default:
        return <ImageIcon className="w-5 h-5 text-blue-400" />;
    }
  };

  if (!ready || !authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink text-white/60 kente-pattern-bg">
        <Loader2 className="h-8 w-8 animate-spin text-volt" />
        <p className="font-mono text-xs uppercase tracking-[0.2em]">Tuning in…</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ink text-bone kente-pattern-bg">
      {/* Main header */}
      <AfroMeetHeader />

      {/* Main container */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8">
        {/* Back and Title */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/app')}
              className="p-2 hover:bg-white/5 rounded-xl transition-all text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Onchain Catalogue</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Explore all active creative works minted on the Arc network.</p>
            </div>
          </div>
          <span className="font-mono text-xs text-volt-light bg-volt/10 border border-volt/20 px-3 py-1 rounded-full font-semibold">
            {works.length} {works.length === 1 ? 'Work' : 'Works'} Minted
          </span>
        </div>

        {/* Loading / Empty States */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-500 text-sm">
            <Loader2 className="w-8 h-8 animate-spin text-volt" />
            <span>Loading catalogue from Arc…</span>
          </div>
        ) : works.length === 0 ? (
          <div className="text-center py-24 glass rounded-2xl border border-zinc-800/80 max-w-md mx-auto">
            <Layers className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <h4 className="font-bold text-white text-base">No works minted yet</h4>
            <p className="text-zinc-500 text-xs mt-1.5 px-6">
              Go to the Studio tab on the main dashboard to mint the first piece of media!
            </p>
            <button
              onClick={() => router.push('/app')}
              className="mt-4 bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold px-5 py-2 rounded-full text-xs transition-all shadow-md"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          /* Works Grid */
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {works.map((w) => (
              <div
                key={w.id}
                className="glass rounded-xl p-5 border border-zinc-850 hover:border-kente-gold/30 transition-all flex flex-col justify-between min-h-[300px]"
              >
                <div>
                  {/* Category Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-zinc-950/60 rounded-lg border border-zinc-900">
                        {renderIcon(w.category)}
                      </div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                        {w.category}
                      </span>
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-400 bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800">
                      #{w.id}
                    </span>
                  </div>

                  {/* Work Title */}
                  <h4 className="font-bold text-white text-sm line-clamp-2">{w.title}</h4>
                  
                  {/* Creator */}
                  <p className="text-zinc-500 text-xs mt-1 truncate">
                    By {w.creator.slice(0, 8)}…{w.creator.slice(-6)}
                  </p>
                </div>

                {/* Info and action */}
                <div className="mt-4 pt-4 border-t border-zinc-900 space-y-3">
                  <div className="flex items-center justify-between text-xs bg-zinc-950/40 p-2.5 rounded border border-zinc-900">
                    <span className="text-zinc-500 font-medium">Access:</span>
                    <span className="font-semibold text-white">
                      {w.mode === 'TIMED' ? 'Timed Streaming' : 'Discrete Unlock'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs bg-zinc-950/40 p-2.5 rounded border border-zinc-900">
                    <span className="text-zinc-500 font-medium">
                      {w.mode === 'TIMED' ? 'Rate / Sec:' : 'Price:'}
                    </span>
                    <span className="font-mono text-amber-400 font-bold">
                      ${w.mode === 'TIMED' ? `${w.ratePerSecondUsdc.toFixed(6)} USDC` : `${w.price} USDC`}
                    </span>
                  </div>

                  {w.vault ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 p-2 rounded justify-center font-semibold">
                      <Layers className="w-3.5 h-3.5" />
                      Fractional Vault Active ({w.totalShares} Shares)
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 bg-zinc-900/40 border border-zinc-850 p-2 rounded justify-center">
                      <Lock className="w-3.5 h-3.5" />
                      Individual Access Protected
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
