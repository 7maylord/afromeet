'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Coins, 
  Layers, 
  Music, 
  Video, 
  FileText,
  User,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

interface EarningsStats {
  totalUSDC: number;
  accessCount: number;
  secondarySales: number;
}

export default function CreatorDashboard() {
  const { user } = usePrivy();
  const [stats, setStats] = useState<EarningsStats>({
    totalUSDC: 284.50,
    accessCount: 14200,
    secondarySales: 45.00
  });

  const [activeTab, setActiveTab] = useState<'created' | 'owned' | 'memberships'>('created');
  const userAddress = user?.wallet?.address || process.env.NEXT_PUBLIC_AFROMEET_NFT_ADDRESS || '0xef0ee06ebfb7536dfce6db0c83aa460ef3ed8322';

  // Fetch earnings from backend
  useEffect(() => {
    async function fetchEarnings() {
      if (!user?.wallet?.address) return;
      try {
        const res = await fetch(`${BACKEND_URL}/creator/${user.wallet.address}/earnings`).then(r => r.json());
        // Map backend responses to stats
        if (res && res.totalEarnings) {
          setStats({
            totalUSDC: Number(res.totalEarnings) / 1e6,
            accessCount: res.accessCount,
            secondarySales: Number(res.secondarySales) / 1e6
          });
        }
      } catch (err) {
        console.warn('Backend earnings fetch failed, showing seeded fallback data.');
      }
    }
    fetchEarnings();
  }, [user?.wallet?.address]);

  // Seeded works galleries
  const createdWorks = [
    { id: '1', title: 'Lagos Grooves & Rhythms', category: 'music', earnings: 14.20 },
    { id: '2', title: 'Tales of Anansi', category: 'writing', earnings: 9.35 },
    { id: '3', title: 'Egungun Masquerade Art', category: 'art', earnings: 22.40 }
  ];

  const ownedWorks = [
    { id: '4', title: 'Ancestral Rhythms Volume 3', category: 'music', artist: 'kwame.eth' },
    { id: '5', title: 'Savanna Sunset', category: 'photography', artist: 'ama.eth' }
  ];

  const renderCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'music': return <Music className="w-4 h-4 text-purple-400" />;
      case 'writing': return <FileText className="w-4 h-4 text-amber-400" />;
      default: return <Video className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid sm:grid-cols-3 gap-6">
        <div className="glass rounded-xl p-5 border border-zinc-800/80">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
              Cumulative Earnings
            </span>
            <Coins className="w-5 h-5 text-kente-gold" />
          </div>
          <p className="font-mono text-3xl font-extrabold text-white mt-2">
            ${stats.totalUSDC.toFixed(2)} <span className="text-sm font-sans text-zinc-500 font-normal">USDC</span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">
            USDC settled directly on Arc L1
          </span>
        </div>

        <div className="glass rounded-xl p-5 border border-zinc-800/80">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
              Total Plays / Views
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="font-mono text-3xl font-extrabold text-white mt-2">
            {stats.accessCount.toLocaleString()}
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">
            Across timed and discrete works
          </span>
        </div>

        <div className="glass rounded-xl p-5 border border-zinc-800/80">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
              Secondary Royalties
            </span>
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <p className="font-mono text-3xl font-extrabold text-white mt-2">
            ${stats.secondarySales.toFixed(2)} <span className="text-sm font-sans text-zinc-500 font-normal">USDC</span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">
            Enforced via AfroMeetRoyalty.sol
          </span>
        </div>
      </div>

      {/* SVG Analytics Chart */}
      <div className="glass rounded-xl p-6 border border-zinc-800/80">
        <h4 className="font-bold text-white text-sm mb-4">Earnings History (Past 7 Days)</h4>
        <div className="w-full h-48 flex items-end justify-between px-2 pt-4 relative border-b border-zinc-800">
          {/* SVG line / bar chart simulation */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[9px] text-zinc-600 font-mono">
            <div className="border-b border-zinc-900 w-full pb-1">50 USDC</div>
            <div className="border-b border-zinc-900 w-full pb-1">25 USDC</div>
            <div className="w-full pb-1">0 USDC</div>
          </div>
          
          <svg className="w-full h-full absolute inset-0 z-0 overflow-visible" preserveAspectRatio="none">
            <path 
              d="M0,150 Q100,100 200,120 T400,60 T600,40 T800,20" 
              fill="none" 
              stroke="url(#chart-grad)" 
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="chart-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7e22ce" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
          </svg>

          {/* Label rows */}
          <span className="text-[10px] text-zinc-500 z-10 w-full text-center pt-2 mt-48 flex justify-between font-mono">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </span>
        </div>
      </div>

      {/* Tabbed Galleries */}
      <div className="glass rounded-xl p-6 border border-zinc-800/80 relative overflow-hidden">
        <div className="flex border-b border-zinc-800 mb-6">
          <button
            onClick={() => setActiveTab('created')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'created' 
                ? 'border-kente-gold text-white font-bold' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            My Creations
          </button>
          
          <button
            onClick={() => setActiveTab('owned')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'owned' 
                ? 'border-kente-gold text-white font-bold' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Owned Works
          </button>

          <button
            onClick={() => setActiveTab('memberships')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'memberships' 
                ? 'border-kente-gold text-white font-bold' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            DAO Memberships
          </button>
        </div>

        {/* Tab content rendering */}
        {activeTab === 'created' && (
          <div className="space-y-3">
            {createdWorks.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3.5 bg-zinc-900/40 rounded-xl border border-zinc-850 hover:bg-zinc-900/80 transition-all text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-850">
                    {renderCategoryIcon(w.category)}
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">{w.title}</h5>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mt-0.5">{w.category}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 block">Total Accrued</span>
                  <span className="font-mono text-white font-bold">${w.earnings.toFixed(2)} USDC</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'owned' && (
          <div className="space-y-3">
            {ownedWorks.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3.5 bg-zinc-900/40 rounded-xl border border-zinc-850 hover:bg-zinc-900/80 transition-all text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-850">
                    {renderCategoryIcon(w.category)}
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">{w.title}</h5>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">By {w.artist}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'memberships' && (
          <div className="space-y-3">
            <div className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-kente-gold" />
                <div>
                  <h5 className="font-bold text-white text-sm">AfroMeet Creator Collective</h5>
                  <p className="text-zinc-500 mt-0.5">Role: Founding Artist</p>
                </div>
              </div>
              <a 
                href={`https://testnet.arcscan.app/address/${userAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-kente-gold hover:underline flex items-center gap-1 font-semibold"
              >
                On-Chain <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
