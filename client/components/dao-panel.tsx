'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import { getArcSigner, ensureAllowance, ensureSelfDelegated } from '@/lib/wallet';
import {
  Building2,
  Plus,
  Check,
  X,
  Loader2,
  TrendingUp,
  Award,
  Coins,
  Users
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const EXPLORER_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER ?? 'https://testnet.arcscan.app';
const NFT_ADDRESS = process.env.NEXT_PUBLIC_AFROMEET_NFT_ADDRESS ?? '';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000';

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'Active' | 'Defeated' | 'Succeeded' | 'Executed';
  votesFor: number;
  votesAgainst: number;
  endTime: string;
}

export default function DaoPanel() {
  const { user, authenticated } = usePrivy();
  const { wallets } = useWallets();
  // Which creator's DAO is being viewed — any creator with a work, so fans can browse and
  // participate in other creators' ecosystems, not just their own.
  const [selectedCreator, setSelectedCreator] = useState<string>('');
  const [creators, setCreators] = useState<{ address: string; works: number }[]>([]);
  const creator = selectedCreator;
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [treasuryBalance, setTreasuryBalance] = useState<string>('0.00');
  const [vibeBalance, setVibeBalance] = useState<number>(0);
  const [hasDao, setHasDao] = useState<boolean>(true);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);

  // Buy-VIBE modal
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyUsdc, setBuyUsdc] = useState('5');
  const [buying, setBuying] = useState(false);

  // Proposal Creation
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const setStatusMsg = (m: { type: 'success' | 'info' | 'error'; text: string; txHash?: string } | null) => {
    if (!m) return;
    const content = (
      <div className="flex flex-col gap-1.5">
        <span className="text-zinc-200">{m.text}</span>
        {m.txHash && (
          <a
            href={`${EXPLORER_URL}/tx/${m.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-amber-400 hover:text-amber-300 underline font-mono flex items-center gap-1 mt-0.5"
          >
            View on Explorer: {m.txHash.slice(0, 12)}…
          </a>
        )}
      </div>
    );
    if (m.type === 'success') toast.success(content);
    else if (m.type === 'error') toast.error(content);
    else toast.info(content);
  };

  // Build the list of creator DAOs from the catalogue (every creator with a work has an ecosystem).
  useEffect(() => {
    fetch(`${BACKEND_URL}/access/catalogue`)
      .then((r) => r.json())
      .then((cat: { creator?: string }[]) => {
        if (!Array.isArray(cat)) return;
        const counts = new Map<string, number>();
        for (const w of cat) {
          if (w.creator) counts.set(w.creator, (counts.get(w.creator) ?? 0) + 1);
        }
        const list = [...counts.entries()].map(([address, works]) => ({ address, works }));
        setCreators(list);
        setSelectedCreator((cur) => {
          if (cur) return cur;
          const me = user?.wallet?.address;
          if (me && list.some((c) => c.address.toLowerCase() === me.toLowerCase())) return me;
          return list[0]?.address ?? me ?? '';
        });
      })
      .catch(() => {});
  }, [user?.wallet?.address]);

  const fetchDaoData = async () => {
    if (!creator) return;
    try {
      const [treasuryRes, proposalsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/dao/${creator}/treasury`).then(r => r.json()),
        fetch(`${BACKEND_URL}/dao/${creator}/proposals`).then(r => r.json())
      ]);

      setHasDao(Boolean(treasuryRes.dao));
      setTokenAddress(treasuryRes.token ?? null);
      setTreasuryBalance((Number(treasuryRes.balance ?? 0) / 1e6).toFixed(2));
      setProposals(Array.isArray(proposalsRes) ? proposalsRes : []);

      const voter = user?.wallet?.address;
      if (treasuryRes.token && voter && wallets[0]) {
        try {
          const provider = new ethers.BrowserProvider(await wallets[0].getEthereumProvider());
          const vibe = new ethers.Contract(
            treasuryRes.token,
            ['function balanceOf(address) view returns (uint256)'],
            provider,
          );
          const bal = await vibe.balanceOf(voter);
          setVibeBalance(Math.round(Number(ethers.formatUnits(bal, 18))));
        } catch {
          setVibeBalance(0);
        }
      } else {
        setVibeBalance(0);
      }
    } catch (err) {
      console.warn('Failed to fetch DAO data:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDaoData();
    const interval = setInterval(fetchDaoData, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator]);

  const handleVote = async (proposalId: string, support: number) => {
    if (!authenticated || !wallets[0]) {
      setStatusMsg({ type: 'error', text: 'Please connect your wallet first.' });
      return;
    }
    setLoading(true);
    setActionId(`vote-${proposalId}`);
    setStatusMsg({ type: 'info', text: 'Casting your DAO vote on Arc...' });

    try {
      // Backend builds the castVote tx; we sign it with the voter's wallet so it uses their VIBE.
      const { to, data } = await fetch(`${BACKEND_URL}/dao/${creator}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, support, voter: user?.wallet?.address })
      }).then(r => r.json());
      if (!to || !data) throw new Error('No DAO found for this creator');

      const signer = await getArcSigner(wallets[0]);
      // Holding VIBE isn't enough to vote — it must be delegated (usually to yourself) first.
      if (tokenAddress) await ensureSelfDelegated(signer, tokenAddress);
      const tx = await signer.sendTransaction({ to, data });
      setStatusMsg({ type: 'info', text: 'Vote transaction broadcasted. Waiting for confirmation…', txHash: tx.hash });
      await tx.wait();

      setStatusMsg({ type: 'success', text: 'Vote cast on-chain with your VIBE power.', txHash: tx.hash });
      fetchDaoData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Vote failed: ${(err as Error).message || err}` });
    } finally {
      setLoading(false);
      setActionId(null);
    }
  };

  // Buy VIBE (governance power) for the DAO in view: pay USDC → treasury, receive VIBE 1:1, then
  // delegate so it counts as votes immediately.
  const handleBuyVibe = async () => {
    if (!authenticated || !wallets[0]) {
      setStatusMsg({ type: 'error', text: 'Please connect your wallet first.' });
      return;
    }
    const amount = Number(buyUsdc);
    if (!amount || amount <= 0) {
      setStatusMsg({ type: 'error', text: 'Enter a USDC amount.' });
      return;
    }
    setBuying(true);
    try {
      const signer = await getArcSigner(wallets[0]);
      const raw = ethers.parseUnits(buyUsdc, 6);

      setStatusMsg({ type: 'info', text: 'Checking USDC approval…' });
      await ensureAllowance(signer, USDC_ADDRESS, NFT_ADDRESS, raw);

      setStatusMsg({ type: 'info', text: `Buying ${amount} VIBE…` });
      const nft = new ethers.Contract(
        NFT_ADDRESS,
        ['function buyVibe(address creator, uint256 usdcAmount) returns (uint256)'],
        signer,
      );
      const tx = await nft.buyVibe(creator, raw);
      setStatusMsg({ type: 'info', text: 'Purchase broadcasted. Confirming…', txHash: tx.hash });
      await tx.wait();

      // Delegate the new VIBE to the buyer so it registers as voting power.
      if (tokenAddress) {
        setStatusMsg({ type: 'info', text: 'Activating voting power…' });
        await ensureSelfDelegated(signer, tokenAddress);
      }

      setStatusMsg({ type: 'success', text: `Bought ${amount} VIBE — voting power active, proceeds sent to the treasury.`, txHash: tx.hash });
      setShowBuyModal(false);
      fetchDaoData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Buy failed: ${(err as Error).message || err}` });
    } finally {
      setBuying(false);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDesc) return;

    if (!wallets[0]) {
      setStatusMsg({ type: 'error', text: 'Connect your wallet first.' });
      return;
    }
    setLoading(true);
    setStatusMsg({ type: 'info', text: 'Deploying governance proposal on Arc...' });

    try {
      const { to, data } = await fetch(`${BACKEND_URL}/dao/${creator}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDesc, proposer: user?.wallet?.address })
      }).then(r => r.json());
      if (!to || !data) throw new Error('No DAO found — mint a work first to create your ecosystem');

      const signer = await getArcSigner(wallets[0]);
      // Holding VIBE isn't enough to propose — it must be delegated (usually to yourself) first.
      if (tokenAddress) await ensureSelfDelegated(signer, tokenAddress);
      const tx = await signer.sendTransaction({ to, data });
      setStatusMsg({ type: 'info', text: 'Proposal deployment broadcasted. Waiting for confirmation…', txHash: tx.hash });
      await tx.wait();

      setStatusMsg({ type: 'success', text: 'Proposal published on-chain via CreatorDAO.', txHash: tx.hash });
      setShowCreateForm(false);
      setNewTitle('');
      setNewDesc('');
      fetchDaoData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Proposal failed: ${(err as Error).message || err}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Creator DAO selector — browse and participate in any creator's ecosystem */}
      {creators.length > 0 && (
        <div className="glass rounded-xl border border-zinc-800/80 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Creator DAOs
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {creators.map((c) => {
              const active = c.address.toLowerCase() === selectedCreator.toLowerCase();
              const isMe = user?.wallet?.address?.toLowerCase() === c.address.toLowerCase();
              return (
                <button
                  key={c.address}
                  onClick={() => setSelectedCreator(c.address)}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs transition-all ${
                    active
                      ? 'border-purple-500/60 bg-purple-950/40 text-purple-200'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {c.address.slice(0, 6)}…{c.address.slice(-4)}
                  {isMe && <span className="ml-1.5 text-[9px] uppercase text-emerald-400">You</span>}
                  <span className="ml-1.5 text-[9px] text-zinc-600">{c.works}w</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
            <button
              onClick={() => setShowBuyModal(true)}
              className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-purple-200"
            >
              <Coins className="w-3 h-3" /> Buy VIBE
            </button>
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
        {proposals.length === 0 && (
          <p className="py-8 text-center text-xs text-zinc-500">
            {hasDao
              ? 'No proposals yet. Create the first one for your DAO.'
              : 'No DAO for this wallet yet — mint a work to spin up your creator ecosystem, then govern it here.'}
          </p>
        )}
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

      {/* Buy VIBE modal */}
      {showBuyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !buying && setShowBuyModal(false)}
        >
          <div
            className="glass-premium w-full max-w-md rounded-2xl border border-white/10 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <h4 className="font-display text-lg font-bold text-white">Buy VIBE</h4>
              <button
                onClick={() => !buying && setShowBuyModal(false)}
                className="text-white/40 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-zinc-400">
              VIBE is this creator&apos;s governance token. Buy it to get voting power in their DAO —{' '}
              <strong className="text-white">1 VIBE = 1 USDC</strong>, and every purchase flows
              straight to the DAO treasury. Your VIBE is auto-delegated so it counts right away.
            </p>

            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Amount (USDC)</label>
            <input
              type="number"
              min="1"
              value={buyUsdc}
              onChange={(e) => setBuyUsdc(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 font-mono text-white"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
              <span>You receive</span>
              <span className="font-mono font-bold text-purple-300">{Number(buyUsdc) || 0} VIBE</span>
            </div>

            <button
              onClick={handleBuyVibe}
              disabled={buying}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-700 py-2.5 font-bold text-white transition-all hover:bg-purple-600 disabled:opacity-50"
            >
              {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              Buy {Number(buyUsdc) || 0} VIBE
            </button>
            <p className="mt-2 text-center text-[10px] text-zinc-600">
              Proceeds fund the treasury · {creator?.slice(0, 6)}…{creator?.slice(-4)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
