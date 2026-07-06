'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Wallet, LogOut, Search, RefreshCw } from 'lucide-react';
import AfroMark from '@/components/afro-mark';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

async function readBalance(address: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/usdc/${address}/balance`).then((r) => r.json());
  return (Number(res.balanceRaw ?? 0) / 1e6).toFixed(2);
}

export default function AfroMeetHeader() {
  const { logout } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();

  const [balance, setBalance] = useState<string>('0.00');
  const userAddress = wallets[0]?.address;

  useEffect(() => {
    if (!userAddress) return;
    let cancelled = false;
    const run = () => readBalance(userAddress).then(b => { if (!cancelled) setBalance(b); }).catch(console.error);
    run();
    const interval = setInterval(run, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userAddress]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const truncatedAddress = userAddress 
    ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
    : 'Not Connected';

  return (
    <header className="glass relative z-25 w-full border-b border-white/5 px-6 py-4">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
        {/* Brand */}
        <div className="flex cursor-pointer items-center gap-2.5" onClick={() => router.push('/')}>
          <AfroMark size={20} className="text-ember" />
          <div className="leading-none">
            <h1 className="font-display text-lg font-bold lowercase tracking-tight"><span className="text-ember">afro</span><span className="text-volt">meet</span></h1>
            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
              Africa · pressed onchain
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <form action="/app/catalogue" method="get" className="relative w-full max-w-sm">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            name="q"
            defaultValue={typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('q') ?? ''}
            placeholder="Search creators or works…"
            aria-label="Search creators or works"
            className="w-full rounded-xl border border-white/8 bg-white/[0.03] py-2 pl-9 pr-4 text-sm text-bone placeholder-white/35 transition-all focus:border-volt/60 focus:outline-none focus:ring-1 focus:ring-volt/40"
          />
        </form>

        {/* User Status */}
        <div className="flex items-center gap-3">
          {/* USDC Balance */}
          {userAddress && (
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">USDC</span>
              <span className="font-mono font-bold text-ember">${balance}</span>
              <button
                onClick={() => userAddress && readBalance(userAddress).then(setBalance).catch(console.error)}
                className="ml-1 text-white/40 transition-colors hover:text-bone"
                aria-label="Refresh balance"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Wallet address and LogOut */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-1.5 font-mono text-xs text-bone/80">
              <Wallet className="h-3.5 w-3.5 text-volt" />
              {truncatedAddress}
            </div>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-2 text-white/50 transition-all hover:bg-white/[0.06] hover:text-red-400"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
