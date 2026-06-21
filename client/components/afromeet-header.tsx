'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Wallet, LogOut, Search, RefreshCw } from 'lucide-react';

const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com/v1/swrm_8a4be899b9561216f7e12003014260df2d070beec86b3207438f8360019cfaa3';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000';

export default function AfroMeetHeader() {
  const { logout, user } = usePrivy();
  const router = useRouter();
  
  const [balance, setBalance] = useState<string>('0.00');
  const [loading, setLoading] = useState<boolean>(false);
  const userAddress = user?.wallet?.address;

  const fetchBalance = async () => {
    if (!userAddress) return;
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
      const usdc = new ethers.Contract(
        USDC_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );
      const bal = await usdc.balanceOf(userAddress);
      setBalance((Number(bal) / 1e6).toFixed(2));
    } catch (err) {
      console.error('Error fetching balance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 20000);
    return () => clearInterval(interval);
  }, [userAddress]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const truncatedAddress = userAddress 
    ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
    : 'Not Connected';

  return (
    <header className="w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-6 py-4 relative z-25">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
          <Image 
            src="/logo.png" 
            alt="AfroMeet Logo" 
            width={38} 
            height={38}
            className="rounded-full shadow-lg"
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Afro<span className="text-kente-gold">Meet</span>
            </h1>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold block -mt-1">
              Creative Economy
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-full max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search creators or works..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-9 pr-4 py-1.5 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-kente-gold/50 focus:ring-1 focus:ring-kente-gold/30 transition-all"
          />
        </div>

        {/* User Status */}
        <div className="flex items-center gap-4">
          {/* USDC Balance */}
          {userAddress && (
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-xs">
              <span className="text-zinc-500">USDC:</span>
              <span className="font-mono font-bold text-white">${balance}</span>
              <button 
                onClick={fetchBalance}
                disabled={loading}
                className={`text-zinc-500 hover:text-white transition-colors ml-1 ${loading ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Wallet address and LogOut */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-3.5 py-1 text-xs font-mono text-zinc-300">
              <Wallet className="w-3.5 h-3.5 text-kente-gold" />
              {truncatedAddress}
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-red-400 text-zinc-400 rounded-full transition-all"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
