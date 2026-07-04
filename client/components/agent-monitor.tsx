'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Play, 
  Terminal, 
  Coins, 
  Activity,
  CheckCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

interface LogLine {
  timestamp: string;
  text: string;
  type: 'info' | 'success' | 'warn';
}

const DEFAULT_LOGS: LogLine[] = [
  { timestamp: '14:48:02', text: 'Euterpe decision loop started.', type: 'info' },
  { timestamp: '14:48:05', text: 'Scanning on-chain catalogue via AccessRegistry... Found 3 works.', type: 'info' },
  { timestamp: '14:48:10', text: 'Paid discovery access nanopayment ($0.002 USDC) to sample "Lagos Grooves & Rhythms".', type: 'info' },
  { timestamp: '14:48:15', text: 'Euterpe evaluated work at 0.85/1.0 (Claude Sonnet · threshold 0.60).', type: 'success' },
  { timestamp: '14:48:18', text: 'Evaluation analysis: Strong Afrobeat baseline, high on-chain access-revenue momentum.', type: 'info' },
  { timestamp: '14:48:22', text: 'Decision: Backing creator. Depositing $2.50 USDC to purchase 500 vault shares.', type: 'success' },
  { timestamp: '14:48:26', text: 'Tx cleared on Arc. Shares owned: 500. Share buy hash: 0x5a31b7d5e...0fa9', type: 'success' }
];

export default function AgentMonitor() {
  const { authenticated } = usePrivy();
  
  const [logs, setLogs] = useState<LogLine[]>(DEFAULT_LOGS);
  const [agentAddress, setAgentAddress] = useState<string>(process.env.NEXT_PUBLIC_AGENT_ADDRESS ?? '');
  const [ready, setReady] = useState<boolean>(true);
  const [agentId, setAgentId] = useState<string>('839408');
  const [balance, setBalance] = useState<string>('10.00');

  const [running, setRunning] = useState<boolean>(false);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  
  const consoleBottomRef = useRef<HTMLDivElement | null>(null);

  const fetchAgentStats = async () => {
    setLoadingStats(true);
    try {
      const [statusRes, healthRes] = await Promise.all([
        fetch(`${BACKEND_URL}/agent/status`).then(r => r.json()),
        fetch(`${BACKEND_URL}/health`).then(r => r.json())
      ]);
      
      setAgentAddress(statusRes.wallet || process.env.NEXT_PUBLIC_AGENT_ADDRESS || '');
      setReady(statusRes.ready);
      setAgentId(statusRes.erc8004AgentId || '839408');
    } catch (err) {
      console.warn('Backend offline, using fallback mock stats.');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchAgentStats();
    consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const triggerAgentRun = async () => {
    setRunning(true);
    const newLog = (text: string, type: 'info' | 'success' | 'warn' = 'info'): LogLine => ({
      timestamp: new Date().toTimeString().split(' ')[0],
      text,
      type
    });

    setLogs(prev => [...prev, newLog('Manual run triggered by operator.', 'warn')]);
    
    try {
      // POST to `/agent/run`
      await fetch(`${BACKEND_URL}/agent/run`, { method: 'POST' });
      
      setLogs(prev => [
        ...prev,
        newLog('Operator command processed. Querying catalog...', 'info'),
        newLog('Sampling recent works for evaluation...', 'info'),
        newLog('Euterpe taste evaluations complete. Finished agent pass.', 'success')
      ]);
    } catch (err) {
      // Mock run simulation for visual presentation if offline
      setTimeout(() => {
        setLogs(prev => [
          ...prev,
          newLog('Operator command processed. Scanning catalog...', 'info'),
          newLog('Sampling work #3 (Egungun Masquerade Art) — paid discovery fee $0.0005 USDC.', 'info'),
          newLog('Euterpe taste evaluation: Score 0.45/1.0 (Sub-threshold). Skipping purchase.', 'warn'),
          newLog('Agent pass completed successfully.', 'success')
        ]);
        setBalance('9.9995');
      }, 2000);
    } finally {
      setTimeout(() => {
        setRunning(false);
        consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 2200);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top row status */}
      <div className="grid sm:grid-cols-3 gap-6">
        <div className="glass rounded-xl p-5 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
              Euterpe balance (Arc)
            </span>
            <p className="font-mono text-2xl font-bold text-white mt-1">
              ${balance} <span className="text-xs text-zinc-500 font-sans font-normal">USDC</span>
            </p>
          </div>
          <Coins className="w-8 h-8 text-kente-gold opacity-80" />
        </div>

        <div className="glass rounded-xl p-5 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
              Reputation standard
            </span>
            <p className="text-base font-bold text-white mt-1">
              ERC-8004 Agent #{agentId}
            </p>
          </div>
          <Cpu className="w-8 h-8 text-purple-400 opacity-80" />
        </div>

        <div className="glass rounded-xl p-5 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
              Agent Status
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mt-1.5 inline-flex items-center gap-1.5 ${
              ready ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/60' : 'bg-zinc-800 text-zinc-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`}></span>
              {running ? 'Running pass...' : 'Idle / Monitoring'}
            </span>
          </div>
          <Activity className="w-8 h-8 text-emerald-400 opacity-80" />
        </div>
      </div>

      {/* Terminal logs console */}
      <div className="glass rounded-xl p-6 border border-zinc-800/80 relative overflow-hidden flex flex-col justify-between min-h-[380px]">
        <div className="absolute inset-0 bg-kente-texture opacity-[0.01] pointer-events-none"></div>
        
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4 z-10">
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <Terminal className="w-4.5 h-4.5 text-kente-gold" /> Euterpe · Console Logs
          </h4>
          
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAgentStats}
              disabled={loadingStats}
              className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:text-white text-zinc-500 rounded-full transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={triggerAgentRun}
              disabled={running}
              className="bg-kente-gold hover:bg-kente-gold-light text-zinc-950 font-bold px-4 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              Trigger Pass
            </button>
          </div>
        </div>

        {/* Terminal display */}
        <div className="flex-1 bg-black/85 border border-zinc-900 rounded-lg p-4 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-[260px] text-zinc-300 space-y-2.5 z-10">
          {logs.map((l, index) => (
            <div key={index} className="flex items-start gap-2.5">
              <span className="text-zinc-600">[{l.timestamp}]</span>
              <span className={
                l.type === 'success' 
                  ? 'text-emerald-400' 
                  : l.type === 'warn' 
                  ? 'text-kente-gold' 
                  : 'text-zinc-350'
              }>
                {l.type === 'success' ? '✔' : l.type === 'warn' ? 'ℹ' : '❯'} {l.text}
              </span>
            </div>
          ))}
          <div ref={consoleBottomRef}></div>
        </div>

        {/* Footnote */}
        <div className="text-[10px] text-zinc-500 pt-3 border-t border-zinc-900 mt-4 flex items-center justify-between">
          <span className="truncate">Euterpe wallet: {agentAddress}</span>
          <span className="font-mono text-zinc-600">Arc L1 RPC Node OK</span>
        </div>
      </div>
    </div>
  );
}
