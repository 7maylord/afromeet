'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Coins, ExternalLink, RefreshCw, Heart, CheckCircle2 } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const EXPLORER = process.env.NEXT_PUBLIC_ARC_EXPLORER || 'https://testnet.arcscan.app';

interface Pick {
  tokenId: string;
  creator: string;
  contentUri: string;
  score: number;
  note: string;
  paidUsdc: number;
  accessTx: string | null;
  backed: boolean;
  at: string;
  title?: string;
}

const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export default function AgentPicks() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [picksRes, catRes] = await Promise.all([
        fetch(`${BACKEND_URL}/agent/picks`).then((r) => r.json()),
        fetch(`${BACKEND_URL}/access/catalogue`).then((r) => r.json()).catch(() => [])
      ]);
      
      const titleMap = new Map<string, string>();
      if (Array.isArray(catRes)) {
        catRes.forEach((w: any) => {
          titleMap.set(String(w.id), w.title || `Work #${w.id}`);
        });
      }
      
      const rawPicks = picksRes.picks ?? [];
      const mapped = rawPicks.slice(0, 5).map((p: any) => ({
        ...p,
        title: titleMap.get(String(p.tokenId)) || `Work #${p.tokenId}`
      }));
      
      setPicks(mapped);
      setAgentId(picksRes.agentId ?? null);
    } catch {
      /* backend offline — keep empty state */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <Sparkles className="h-5 w-5 text-kente-gold" />
            What Euterpe is enjoying today
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Works Euterpe, AfroMeet&apos;s patron agent, paid to access and liked
            {agentId ? ` · ERC-8004 #${agentId}` : ''}. Curated, on-chain recommendations.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {picks.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-800 py-10 text-center text-zinc-500">
          Euterpe hasn’t picked anything yet — trigger a run from her console.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="py-2 pr-4">Work</th>
                <th className="py-2 pr-4">Creator</th>
                <th className="py-2 pr-4">Euterpe’s take</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Paid</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Proof</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((p, i) => (
                <tr key={`${p.tokenId}-${i}`} className="border-b border-zinc-800/60">
                  <td className="py-3 pr-4 font-medium text-zinc-200">{p.title}</td>
                  <td className="py-3 pr-4 font-mono text-zinc-400">{shortAddr(p.creator)}</td>
                  <td className="py-3 pr-4 max-w-xs text-zinc-300">{p.note}</td>
                  <td className="py-3 pr-4 text-kente-gold">{Math.round(p.score * 100)}%</td>
                  <td className="py-3 pr-4 text-zinc-300">
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5 text-zinc-500" />${p.paidUsdc}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {p.backed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-kente-gold/15 px-2 py-0.5 text-xs text-kente-gold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Backed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                        <Heart className="h-3.5 w-3.5" /> Liked
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {p.accessTx ? (
                      <a
                        href={`${EXPLORER}/tx/${p.accessTx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-zinc-400 hover:text-kente-gold"
                      >
                        tx <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
