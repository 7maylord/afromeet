'use client';

import { useEffect, useState } from 'react';
import { Radio, Cpu } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

interface Feed {
  online: boolean;
  block: number;
  wallet: string | null;
  agentId: string | null;
  ready: boolean;
  ticker: string;
}

const shortAddr = (a: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');

/**
 * The signature element: a pirate-radio "ON AIR" transmitter for the autonomous
 * Patron Agent. Arc's block height reads like a broadcast frequency; the agent's
 * latest pick scrolls past like a station ID. All live from the backend.
 */
export default function OnAirConsole() {
  const [feed, setFeed] = useState<Feed>({
    online: false,
    block: 0,
    wallet: null,
    agentId: null,
    ready: false,
    ticker: 'Tuning in to Euterpe…',
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [health, status, picks] = await Promise.all([
          fetch(`${BACKEND_URL}/health`).then((r) => r.json()),
          fetch(`${BACKEND_URL}/agent/status`).then((r) => r.json()),
          fetch(`${BACKEND_URL}/agent/picks`).then((r) => r.json()).catch(() => null),
        ]);
        if (cancelled) return;

        const latest = picks?.picks?.[0];
        const ticker = latest
          ? `NOW BACKING · Work #${latest.tokenId} — ${latest.note}`
          : 'Scanning the catalogue for works worth backing onchain…';

        setFeed({
          online: health?.status === 'ok',
          block: health?.arc?.blockNumber || 0,
          wallet: status?.wallet ?? null,
          agentId: status?.erc8004AgentId ?? null,
          ready: !!status?.ready,
          ticker,
        });
      } catch {
        if (!cancelled) setFeed((f) => ({ ...f, online: false, ticker: 'Euterpe is off air — backend unreachable.' }));
      }
    }

    poll();
    const id = setInterval(poll, 12000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="animate-fade-up delay-5 pointer-events-auto w-[280px] sm:w-80">
      <div className="liquid-glass rounded-2xl p-4" style={{ background: 'rgba(10,10,12,0.55)' }}>
        {/* Transmitter header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {feed.online && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt opacity-70" />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  feed.online ? 'bg-volt' : 'bg-zinc-600'
                }`}
              />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone">
              {feed.online ? 'On Air' : 'Off Air'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
              Euterpe
            </span>
            <Radio className="h-4 w-4 text-volt" />
          </div>
        </div>

        {/* Frequency = Arc block height */}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
              Arc frequency · block
            </span>
            <span className="font-mono text-2xl leading-none text-bone tabular-nums">
              {feed.block ? feed.block.toLocaleString() : '––––––'}
            </span>
          </div>
          {/* Live equaliser */}
          <div className="flex h-7 items-end gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`w-[3px] rounded-full ${feed.online ? 'bg-volt eq-bar' : 'bg-zinc-700'}`}
                style={{ height: '100%', animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        </div>

        {/* Station ID ticker */}
        <div className="mt-3 overflow-hidden rounded-lg bg-black/40 py-1.5">
          <div className="marquee-track font-mono text-[11px] text-volt-light">
            <span className="px-4">{feed.ticker}</span>
            <span className="px-4">{feed.ticker}</span>
          </div>
        </div>

        {/* Agent identity */}
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[10px] text-white/50">
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-ember" />
            ERC-8004 {feed.agentId ? `#${feed.agentId}` : 'unregistered'}
          </span>
          <span className="tabular-nums">{shortAddr(feed.wallet)}</span>
        </div>
      </div>
    </div>
  );
}
