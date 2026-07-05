"use client";

import { useWallets } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import {
  TrendingUp,
  Coins,
  Layers,
  Music,
  Video,
  FileText,
} from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

interface EarningsStats {
  totalUSDC: number;
  accessCount: number;
  secondarySales: number;
}

interface CreatedWork {
  id: string;
  title: string;
  category: string;
  terms: string;
}

interface RawWork {
  id: string;
  creator: string;
  title: string;
  category: string | null;
  mode: "TIMED" | "DISCRETE";
  pricePerAccessUsdc: number;
  ratePerSecondUsdc: number;
  minAccessSeconds: number;
  tokenURI: string;
}

export default function CreatorDashboard() {
  const { wallets } = useWallets();
  const [stats, setStats] = useState<EarningsStats>({
    totalUSDC: 0,
    accessCount: 0,
    secondarySales: 0,
  });
  const [createdWorks, setCreatedWorks] = useState<CreatedWork[]>([]);

  const [activeTab, setActiveTab] = useState<
    "created" | "owned" | "memberships"
  >("created");
  const userAddress = wallets[0]?.address;

  // Real earnings, settled on Arc, read from AccessEscrow events via the backend.
  useEffect(() => {
    if (!userAddress) return;
    fetch(`${BACKEND_URL}/creator/${userAddress}/earnings`)
      .then((r) => r.json())
      .then((res) => {
        if (!res) return;
        setStats({
          totalUSDC: Number(res.totalEarnings ?? 0) / 1e6,
          accessCount: Number(res.accessCount ?? 0),
          secondarySales: Number(res.secondarySales ?? 0) / 1e6,
        });
      })
      .catch(() => {
        /* backend offline — leave zeros */
      });
  }, [userAddress]);

  // Real created works: the on-chain catalogue filtered to this creator.
  useEffect(() => {
    if (!userAddress) return;
    fetch(`${BACKEND_URL}/access/catalogue`)
      .then((r) => r.json())
      .then((cat: RawWork[]) => {
        const mine = Array.isArray(cat)
          ? cat.filter(
              (w) => w.creator?.toLowerCase() === userAddress.toLowerCase(),
            )
          : [];
        const works = mine.map((w) => {
          const terms =
            w.mode === "TIMED"
              ? `$${w.ratePerSecondUsdc}/sec · min ${w.minAccessSeconds}s`
              : `$${w.pricePerAccessUsdc} / unlock`;
          return {
            id: w.id,
            title: w.title || `Work #${w.id}`,
            category: w.category || (w.mode === "TIMED" ? "music" : "writing"),
            terms,
          };
        });
        setCreatedWorks(works);
      })
      .catch(() => setCreatedWorks([]));
  }, [userAddress]);

  const renderCategoryIcon = (cat: string) => {
    switch (cat) {
      case "music":
        return <Music className="w-4 h-4 text-purple-400" />;
      case "writing":
        return <FileText className="w-4 h-4 text-amber-400" />;
      default:
        return <Video className="w-4 h-4 text-emerald-400" />;
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
            ${stats.totalUSDC.toFixed(2)}{" "}
            <span className="text-sm font-sans text-zinc-500 font-normal">
              USDC
            </span>
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
            ${stats.secondarySales.toFixed(2)}{" "}
            <span className="text-sm font-sans text-zinc-500 font-normal">
              USDC
            </span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">
            Enforced via AfroMeetRoyalty.sol
          </span>
        </div>
      </div>

      {/* Tabbed Galleries */}
      <div className="glass rounded-xl p-6 border border-zinc-800/80 relative overflow-hidden">
        <div className="flex border-b border-zinc-800 mb-6">
          <button
            onClick={() => setActiveTab("created")}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === "created"
                ? "border-kente-gold text-white font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            My Creations
          </button>

          <button
            onClick={() => setActiveTab("owned")}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === "owned"
                ? "border-kente-gold text-white font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Owned Works
          </button>

          <button
            onClick={() => setActiveTab("memberships")}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === "memberships"
                ? "border-kente-gold text-white font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            DAO Memberships
          </button>
        </div>

        {/* Tab content rendering */}
        {activeTab === "created" &&
          (createdWorks.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-500">
              {userAddress
                ? "No works minted from this wallet yet. Head to Studio to mint your first."
                : "Connect a wallet to see your creations."}
            </p>
          ) : (
            <div className="space-y-3">
              {createdWorks.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between p-3.5 bg-zinc-900/40 rounded-xl border border-zinc-850 hover:bg-zinc-900/80 transition-all text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-850">
                      {renderCategoryIcon(w.category)}
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">{w.title}</h5>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mt-0.5">
                        Token #{w.id} · {w.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 block">
                      Access terms
                    </span>
                    <span className="font-mono text-white font-bold">
                      {w.terms}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {activeTab === "owned" && (
          <p className="py-8 text-center text-xs text-zinc-500">
            Owned works and fractional shares appear here. Buy into a work from
            the Market &amp; Vaults tab.
          </p>
        )}

        {activeTab === "memberships" && (
          <p className="py-8 text-center text-xs text-zinc-500">
            Mint a work to spin up your creator DAO, or vote in one from the
            Creator DAOs tab.
          </p>
        )}
      </div>
    </div>
  );
}
