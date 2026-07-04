'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import AfroMeetHeader from '@/components/afromeet-header';
import MediaPlayer from '@/components/media-player';
import MintForm from '@/components/mint-form';
import MarketplacePanel from '@/components/marketplace-panel';
import DaoPanel from '@/components/dao-panel';
import CreatorDashboard from '@/components/creator-dashboard';
import AgentMonitor from '@/components/agent-monitor';
import AgentPicks from '@/components/agent-picks';
import {
  Play, 
  PlusCircle, 
  ShoppingBag, 
  Users, 
  TrendingUp, 
  Cpu, 
  ArrowLeft,
  Loader2 
} from 'lucide-react';

type TabId = 'discover' | 'studio' | 'marketplace' | 'daos' | 'dashboard' | 'agent';

export default function AppHome() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('discover');

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/');
    }
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink text-white/60 kente-pattern-bg">
        <Loader2 className="h-8 w-8 animate-spin text-volt" />
        <p className="font-mono text-xs uppercase tracking-[0.2em]">Tuning in…</p>
      </div>
    );
  }

  const tabs = [
    { id: 'discover' as TabId, label: 'Discover', icon: Play },
    { id: 'studio' as TabId, label: 'Studio', icon: PlusCircle },
    { id: 'marketplace' as TabId, label: 'Market & Vaults', icon: ShoppingBag },
    { id: 'daos' as TabId, label: 'Creator DAOs', icon: Users },
    { id: 'dashboard' as TabId, label: 'Earnings', icon: TrendingUp },
    { id: 'agent' as TabId, label: 'Euterpe', icon: Cpu }
  ];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ink text-bone kente-pattern-bg">
      {/* Main header */}
      <AfroMeetHeader />

      {/* Main app body */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 md:flex-row">

        {/* Sidebar tabs */}
        <aside className="glass flex h-fit w-full flex-col gap-2 rounded-2xl p-3 md:w-64">
          <span className="mb-2 block px-3 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">
            Workspace
          </span>

          <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border-l-2 px-4 py-3 text-sm tracking-wide transition-all ${
                    active
                      ? 'border-volt bg-volt/12 text-bone'
                      : 'border-transparent text-white/50 hover:bg-white/[0.04] hover:text-bone'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-volt' : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-white/8 px-3 pt-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/40 transition-colors hover:text-bone"
            >
              <ArrowLeft className="h-3 w-3" /> Back to landing
            </button>
          </div>
        </aside>

        {/* Tab content view */}
        <main className="flex-1 min-h-[500px]">
          {activeTab === 'discover' && (
            <>
              <MediaPlayer />
              <AgentPicks />
            </>
          )}
          {activeTab === 'studio' && <MintForm />}
          {activeTab === 'marketplace' && <MarketplacePanel />}
          {activeTab === 'daos' && <DaoPanel />}
          {activeTab === 'dashboard' && <CreatorDashboard />}
          {activeTab === 'agent' && (
            <>
              <AgentMonitor />
              <AgentPicks />
            </>
          )}
        </main>
      </div>

      {/* bottom padding block */}
      <div className="w-full h-8"></div>
    </div>
  );
}
