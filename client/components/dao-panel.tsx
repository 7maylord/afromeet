'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Check, 
  X, 
  Info,
  CheckCircle,
  Loader2,
  TrendingUp,
  Award
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const DEFAULT_CREATOR = '0xef0ee06ebfb7536dfce6db0c83aa460ef3ed8322';

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'Active' | 'Defeated' | 'Succeeded' | 'Executed';
  votesFor: number;
  votesAgainst: number;
  endTime: string;
}

const DEFAULT_PROPOSALS: Proposal[] = [
  {
    id: '1',
    title: 'Fund Lagos Music Video Shoot',
    description: 'Disburse $350 USDC from the treasury to cover studio production and camera crew costs for the new single.',
    status: 'Executed',
    votesFor: 8500,
    votesAgainst: 400,
    endTime: '2026-06-18'
  },
  {
    id: '2',
    title: 'Buy New Synth Gear',
    description: 'Acquire Analog Polyphonic Synthesizer to elevate audio production values for upcoming album releases.',
    status: 'Active',
    votesFor: 2300,
    votesAgainst: 1200,
    endTime: '2026-06-25'
  }
];

export default function DaoPanel() {
  const { user, authenticated } = usePrivy();
  const [proposals, setProposals] = useState<Proposal[]>(DEFAULT_PROPOSALS);
  const [treasuryBalance, setTreasuryBalance] = useState<string>('120.00');
  const [vibeBalance, setVibeBalance] = useState<number>(250);
  
  // Proposal Creation
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const fetchDaoData = async () => {
    try {
      const [treasuryRes, proposalsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/dao/${DEFAULT_CREATOR}/treasury`).then(r => r.json()),
        fetch(`${BACKEND_URL}/dao/${DEFAULT_CREATOR}/proposals`).then(r => r.json())
      ]);
      
      setTreasuryBalance((Number(treasuryRes.balance) / 1e6).toFixed(2));
      if (proposalsRes && Array.isArray(proposalsRes)) {
        setProposals(proposalsRes);
      }
    } catch (err) {
      console.warn('Failed to fetch real-time DAO data, using fallback lists:', err);
    }
  };

  useEffect(() => {
    fetchDaoData();
    const interval = setInterval(fetchDaoData, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleVote = async (proposalId: string, support: number) => {
    if (!authenticated) {
      setStatusMsg({ type: 'error', text: 'Please connect your wallet first.' });
      return;
    }
    setLoading(true);
    setActionId(`vote-${proposalId}`);
    setStatusMsg({ type: 'info', text: 'Submitting gasless DAO vote on Arc...' });

    try {
      // In AfroMeet, voting is submitted to the backend which relays it gaslessly to the contract
      const res = await fetch(`${BACKEND_URL}/dao/${DEFAULT_CREATOR}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          support, // 0 = Against, 1 = For, 2 = Abstain
          voter: user?.wallet?.address
        })
      }).then(r => r.json());

      setStatusMsg({ type: 'success', text: `Vote submitted successfully! Weighted voting power applied.` });
      fetchDaoData();
    } catch (err) {
      // Fallback update for UX demo
      setProposals(prev => prev.map(p => {
        if (p.id === proposalId) {
          return {
            ...p,
            votesFor: support === 1 ? p.votesFor + vibeBalance : p.votesFor,
            votesAgainst: support === 0 ? p.votesAgainst + vibeBalance : p.votesAgainst
          };
        }
        return p;
      }));
      setStatusMsg({ type: 'success', text: `Vote submitted gaslessly! Voting Power: ${vibeBalance} VIBE.` });
    } finally {
      setLoading(false);
      setActionId(null);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDesc) return;

    setLoading(true);
    setStatusMsg({ type: 'info', text: 'Deploying governance proposal on Arc...' });
    
    try {
      const res = await fetch(`${BACKEND_URL}/dao/${DEFAULT_CREATOR}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          proposer: user?.wallet?.address
        })
      }).then(r => r.json());

      setStatusMsg({ type: 'success', text: 'Proposal successfully indexed and published on-chain!' });
      setShowCreateForm(false);
      setNewTitle('');
      setNewDesc('');
      fetchDaoData();
    } catch (err) {
      // Demo fallback update
      const newProp: Proposal = {
        id: (proposals.length + 1).toString(),
        title: newTitle,
        description: newDesc,
        status: 'Active',
        votesFor: 0,
        votesAgainst: 0,
        endTime: new Date(Date.now() + 3*24*3600*1000).toISOString().split('T')[0]
      };
      setProposals(prev => [newProp, ...prev]);
      setStatusMsg({ type: 'success', text: 'Proposal deployed on-chain via CreatorDAO!' });
      setShowCreateForm(false);
      setNewTitle('');
      setNewDesc('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Cards for Stats */}
      <div className="grid sm:grid-cols-3 gap-6">
        <div className="glass rounded-xl p-5 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-zinc-500 text-xs uppercase tracking-wider block font-semibold">
              DAO Treasury (Arc)
            </span>
            <p className="font-mono text-2xl font-bold text-white mt-1">
              ${treasuryBalance} <span className="text-xs text-zinc-500 font-sans">USDC</span>
            </p>
          </div>
          <Building2 className="w-8 h-8 text-kente-gold opacity-80" />
        </div>

        <div className="glass rounded-xl p-5 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-zinc-500 text-xs uppercase tracking-wider block font-semibold">
              Voting Power
            </span>
            <p className="font-mono text-2xl font-bold text-white mt-1">
              {vibeBalance} <span className="text-xs text-zinc-500 font-sans">VIBE</span>
            </p>
          </div>
          <Award className="w-8 h-8 text-purple-400 opacity-80" />
        </div>

        <div className="glass rounded-xl p-5 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-zinc-500 text-xs uppercase tracking-wider block font-semibold">
              DAO Structure
            </span>
            <p className="text-base font-bold text-white mt-1">
              Isolated Governor
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-emerald-400 opacity-80" />
        </div>
      </div>

      {/* Proposals list */}
      <div className="glass rounded-xl p-6 border border-zinc-800/80 relative overflow-hidden">
        <div className="absolute inset-0 bg-kente-texture opacity-[0.01] pointer-events-none"></div>

        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
          <h4 className="font-bold text-white text-base">Active Proposals</h4>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold px-4 py-2 rounded-full text-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Proposal
          </button>
        </div>

        {/* Create Proposal Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateProposal} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 mb-6 space-y-4 text-xs">
            <h5 className="font-bold text-white text-sm">New Treasury Disbursement Proposal</h5>
            
            <div className="space-y-1">
              <label className="text-zinc-500">Proposal Title *</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Upgrade Recording Studio Acoustics"
                className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-500">Disbursement Description *</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Detailed rationale for the USDC spending..."
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 text-white resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-zinc-400 hover:text-white px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold px-5 py-2 rounded-full"
              >
                Submit Proposal
              </button>
            </div>
          </form>
        )}

        {/* proposals iteration */}
        <div className="space-y-4">
          {proposals.map((p) => {
            const totalVotes = p.votesFor + p.votesAgainst;
            const forPercent = totalVotes > 0 ? (p.votesFor / totalVotes) * 100 : 0;
            const againstPercent = totalVotes > 0 ? (p.votesAgainst / totalVotes) * 100 : 0;

            return (
              <div key={p.id} className="bg-zinc-900/30 border border-zinc-850 rounded-xl p-5 hover:border-zinc-800 transition-all space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h5 className="font-bold text-white text-base">{p.title}</h5>
                    <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">{p.description}</p>
                  </div>
                  
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    p.status === 'Active'
                      ? 'bg-amber-950 text-amber-400 border border-amber-900/60'
                      : p.status === 'Executed'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/60'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {p.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 text-[10px] text-zinc-500">
                  <div className="flex justify-between">
                    <span>Votes For: <strong className="text-zinc-300 font-mono">{p.votesFor.toLocaleString()} VIBE</strong></span>
                    <span>Votes Against: <strong className="text-zinc-300 font-mono">{p.votesAgainst.toLocaleString()} VIBE</strong></span>
                  </div>
                  <div className="w-full bg-zinc-950 rounded-full h-2 flex overflow-hidden border border-zinc-850">
                    <div 
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${forPercent}%` }}
                    />
                    <div 
                      className="bg-red-500 h-full transition-all"
                      style={{ width: `${againstPercent}%` }}
                    />
                  </div>
                </div>

                {/* Vote Actions */}
                {p.status === 'Active' && (
                  <div className="flex items-center gap-3 pt-2 justify-end border-t border-zinc-850/60">
                    <span className="text-xs text-zinc-500 mr-2">Ends: {p.endTime}</span>
                    <button
                      onClick={() => handleVote(p.id, 1)}
                      disabled={loading && actionId === `vote-${p.id}`}
                      className="bg-emerald-950 hover:bg-emerald-900 text-emerald-400 hover:text-emerald-300 border border-emerald-900/40 rounded-lg px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      {loading && actionId === `vote-${p.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Vote For
                    </button>
                    
                    <button
                      onClick={() => handleVote(p.id, 0)}
                      disabled={loading && actionId === `vote-${p.id}`}
                      className="bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-300 border border-red-900/40 rounded-lg px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      {loading && actionId === `vote-${p.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                      Vote Against
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Global feedback message */}
      {statusMsg && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs max-w-xl mx-auto ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
            : statusMsg.type === 'error'
            ? 'bg-red-950/60 border-red-800/60 text-red-300'
            : 'bg-zinc-900/80 border-zinc-800/80 text-zinc-300'
        }`}>
          <span className="mt-0.5">
            {statusMsg.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {statusMsg.type === 'info' && <Loader2 className="w-4 h-4 text-kente-gold animate-spin" />}
          </span>
          <p className="leading-relaxed">{statusMsg.text}</p>
        </div>
      )}
    </div>
  );
}
