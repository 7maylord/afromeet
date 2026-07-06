'use client';

import { useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { Coins, ExternalLink } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const EXPLORER = process.env.NEXT_PUBLIC_ARC_EXPLORER ?? 'https://testnet.arcscan.app';

interface Payment {
  tokenId: string;
  amountRaw: string;
  daoCutRaw: string;
  txHash: string;
  timestamp: number;
}

function ago(ts: number): string {
  if (!ts) return '';
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** A creator's "you got paid" feed — each access settlement on their works, newest first. */
export default function PaymentHistory() {
  const { wallets } = useWallets();
  const address = wallets[0]?.address;
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const load = () =>
      fetch(`${BACKEND_URL}/creator/${address}/payments`)
        .then((r) => r.json())
        .then((p) => {
          if (!cancelled && Array.isArray(p)) setPayments(p);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address]);

  return (
    <div className="mt-4 border-t border-white/8 pt-4">
      <div className="mb-2 flex items-center gap-1.5 px-2">
        <Coins className="h-3 w-3 text-ember" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">
          Payments
        </span>
      </div>

      {payments.length === 0 ? (
        <p className="px-2 text-[11px] leading-relaxed text-white/30">
          No payments yet — plays land here as they settle.
        </p>
      ) : (
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {payments.map((p) => (
            <li key={p.txHash}>
              <a
                href={`${EXPLORER}/tx/${p.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
              >
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs font-bold text-ember">
                    +${(Number(p.amountRaw) / 1e6).toFixed(4)}
                  </span>
                  <span className="ml-1.5 text-[10px] text-white/40">Work #{p.tokenId}</span>
                </span>
                <span className="ml-2 flex shrink-0 items-center gap-1 text-[10px] text-white/30">
                  {ago(p.timestamp)}
                  <ExternalLink className="h-2.5 w-2.5" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
