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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-kente-gold" />
        <p className="text-sm font-semibold tracking-wider">Authenticating session...</p>
      </div>
    );
  }

  const tabs = [
    { id: 'discover' as TabId, label: 'Discover & Player', icon: Play },
    { id: 'studio' as TabId, label: 'Creator Studio', icon: PlusCircle },
    { id: 'marketplace' as TabId, label: 'Marketplace & Vaults', icon: ShoppingBag },
    { id: 'daos' as TabId, label: 'Creator DAOs', icon: Users },
    { id: 'dashboard' as TabId, label: 'Dashboard & Profile', icon: TrendingUp },
    { id: 'agent' as TabId, label: 'Patron Agent Logs', icon: Cpu }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative overflow-hidden kente-pattern-bg">
      <div className="absolute inset-0 bg-zinc-950/90 z-0"></div>

      {/* Main header */}
      <AfroMeetHeader />

      {/* Main app body */}
      <div className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar tabs */}
        <aside className="w-full md:w-64 flex flex-col gap-2 bg-zinc-900/30 p-3 rounded-2xl border border-zinc-900 backdrop-blur-md h-fit">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-3 mb-2 block">
            Workspace
          </span>
          
          <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    activeTab === tab.id
                      ? 'bg-kente-gold text-zinc-950 font-bold shadow-md shadow-kente-gold/10'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="border-t border-zinc-800/80 mt-4 pt-4 px-3 flex flex-col gap-2">
            <button
              onClick={() => router.push('/')}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Landing Page
            </button>
          </div>
        </aside>

        {/* Tab content view */}
        <main className="flex-1 min-h-[500px]">
          {activeTab === 'discover' && <MediaPlayer />}
          {activeTab === 'studio' && <MintForm />}
          {activeTab === 'marketplace' && <MarketplacePanel />}
          {activeTab === 'daos' && <DaoPanel />}
          {activeTab === 'dashboard' && <CreatorDashboard />}
          {activeTab === 'agent' && <AgentMonitor />}
        </main>
      </div>

      {/* bottom padding block */}
      <div className="w-full h-8"></div>
    </div>
  );
}
