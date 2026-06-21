'use client';

import { usePrivy } from '@privy-io/react-auth';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  Music, 
  Film, 
  BookOpen, 
  Image as ImageIcon, 
  Camera, 
  Wallet, 
  TrendingUp, 
  Users, 
  Activity,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export default function Home() {
  const { login, authenticated, user, logout } = usePrivy();
  const router = useRouter();
  
  const [agentStatus, setAgentStatus] = useState<{
    status: string;
    blockNumber: number;
    agentWallet: string | null;
    agentId: string | null;
  }>({
    status: 'connecting',
    blockNumber: 0,
    agentWallet: null,
    agentId: null
  });

  // Fetch backend/agent status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const [healthRes, agentRes] = await Promise.all([
          fetch(`${BACKEND_URL}/health`).then(r => r.json()),
          fetch(`${BACKEND_URL}/agent/status`).then(r => r.json())
        ]);
        
        setAgentStatus({
          status: healthRes.status === 'ok' ? 'active' : 'inactive',
          blockNumber: healthRes.arc?.blockNumber || 0,
          agentWallet: agentRes.wallet,
          agentId: agentRes.erc8004AgentId
        });
      } catch (err) {
        console.error('Failed to fetch backend health:', err);
        setAgentStatus({
          status: 'offline',
          blockNumber: 0,
          agentWallet: null,
          agentId: null
        });
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative overflow-hidden kente-pattern-bg">
      {/* Decorative patterns */}
      <div className="absolute inset-0 bg-zinc-950/90 z-0"></div>
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-kente-purple/10 via-transparent to-transparent pointer-events-none z-0"></div>

      {/* Header */}
      <header className="relative z-10 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="AfroMeet Logo" 
              width={42} 
              height={42}
              className="rounded-full shadow-lg"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Afro<span className="text-kente-gold">Meet</span>
              </h1>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold block -mt-1">
                Arc Network
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {authenticated ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/app')}
                  className="bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold px-5 py-2 rounded-full flex items-center gap-1.5 transition-all text-sm shadow-md"
                >
                  Enter App <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={logout}
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-5 py-2 rounded-full border border-zinc-700 transition-all text-sm"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-16 flex flex-col lg:flex-row items-center justify-between gap-12">
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 bg-purple-900/30 text-purple-300 border border-purple-800/50 px-3 py-1.5 rounded-full text-xs font-medium">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
            </span>
            West African Creative Ownership
          </div>

          <h2 className="text-4xl sm:text-6xl font-extrabold text-white leading-tight tracking-tight">
            Get paid <span className="text-kente-gold">every time</span> your work is experienced.
          </h2>

          <p className="text-lg text-zinc-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Bypass platforms and territorial pool pricing. AfroMeet settlements run on Arc Testnet, moving USDC directly from audience to creator in under 500ms.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            {authenticated ? (
              <button
                onClick={() => router.push('/app')}
                className="w-full sm:w-auto bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold px-8 py-3.5 rounded-full flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-kente-gold/20"
              >
                Go to Dashboard <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={login}
                className="w-full sm:w-auto bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold px-8 py-3.5 rounded-full flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-kente-gold/20"
              >
                Connect with Privy <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Mediums Row */}
          <div className="pt-4 flex flex-wrap justify-center lg:justify-start gap-6 text-zinc-400 text-sm">
            <span className="flex items-center gap-2 bg-zinc-900/60 px-3 py-1.5 rounded-md border border-zinc-800">
              <Music className="w-4 h-4 text-purple-400" /> Music
            </span>
            <span className="flex items-center gap-2 bg-zinc-900/60 px-3 py-1.5 rounded-md border border-zinc-800">
              <Film className="w-4 h-4 text-emerald-400" /> Film
            </span>
            <span className="flex items-center gap-2 bg-zinc-900/60 px-3 py-1.5 rounded-md border border-zinc-800">
              <BookOpen className="w-4 h-4 text-amber-400" /> Writing
            </span>
            <span className="flex items-center gap-2 bg-zinc-900/60 px-3 py-1.5 rounded-md border border-zinc-800">
              <ImageIcon className="w-4 h-4 text-blue-400" /> Art & Photos
            </span>
          </div>
        </div>

        {/* Status Dashboard Panel */}
        <div className="w-full lg:w-[420px] glass-premium rounded-2xl p-6 relative overflow-hidden pulse-gold">
          <div className="absolute inset-0 bg-kente-texture opacity-[0.03]"></div>
          
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-6">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-kente-gold" /> System Status
            </h3>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
              agentStatus.status === 'active' 
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-zinc-800 text-zinc-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                agentStatus.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
              }`}></span>
              {agentStatus.status}
            </span>
          </div>

          <div className="space-y-5 text-sm relative z-10">
            <div>
              <span className="text-zinc-500 block text-xs uppercase tracking-wider font-semibold">
                Arc Network Block
              </span>
              <p className="font-mono text-white text-base mt-0.5">
                {agentStatus.blockNumber ? agentStatus.blockNumber.toLocaleString() : '---'}
              </p>
            </div>

            <div>
              <span className="text-zinc-500 block text-xs uppercase tracking-wider font-semibold">
                Patron Agent ID (ERC-8004)
              </span>
              <p className="font-mono text-white mt-0.5 truncate text-amber-400">
                {agentStatus.agentId ? `#${agentStatus.agentId}` : 'Unregistered'}
              </p>
            </div>

            <div>
              <span className="text-zinc-500 block text-xs uppercase tracking-wider font-semibold">
                Agent Wallet Address
              </span>
              <p className="font-mono text-white mt-0.5 text-xs truncate bg-zinc-950/60 p-2 rounded border border-zinc-850">
                {agentStatus.agentWallet || '---'}
              </p>
            </div>
            
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-400">
              <p className="leading-relaxed">
                The autonomous <strong>Patron Agent</strong> discover, samples, and backs creators by buying fractional shares in works and paying per-access USDC nanopayments.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Value Proposition Grid */}
      <section className="relative z-10 max-w-7xl w-full mx-auto px-6 py-16 border-t border-zinc-900 bg-zinc-950/50">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="bg-purple-950/50 text-purple-400 w-12 h-12 rounded-lg flex items-center justify-center border border-purple-900/50 text-xl">
              ⚡
            </div>
            <h4 className="text-white font-bold text-lg">Per-Access Royalties</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Every playback or view fires a micro-allowance transaction directly to splits set by the creators. No middleman delays.
            </p>
          </div>

          <div className="glass rounded-xl p-6 space-y-4">
            <div className="bg-amber-950/50 text-amber-400 w-12 h-12 rounded-lg flex items-center justify-center border border-amber-900/50 text-xl">
              🏛️
            </div>
            <h4 className="text-white font-bold text-lg">Creator Fan DAOs</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">
              1% of every access payout is funneled to Creator DAO Treasuries. Fans holding VIBE governance tokens direct these capital reserves.
            </p>
          </div>

          <div className="glass rounded-xl p-6 space-y-4">
            <div className="bg-emerald-950/50 text-emerald-400 w-12 h-12 rounded-lg flex items-center justify-center border border-emerald-900/50 text-xl">
              📊
            </div>
            <h4 className="text-white font-bold text-lg">Fractional Ownership</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Creators can pool ownership by lock-depositing work NFTs into Fractional Vaults, allowing fans to own and claim pro-rata revenue.
            </p>
          </div>
        </div>
      </section>

      {/* Adinkra Border at Bottom */}
      <footer className="relative z-10 w-full mt-auto kente-border-bottom">
        <div className="max-w-7xl mx-auto px-6 py-4 text-center text-xs text-zinc-600">
          © 2026 AfroMeet. Built for Lepton Hackathon.
        </div>
      </footer>
    </div>
  );
}
