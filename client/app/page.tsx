'use client';

import { usePrivy, useLogin } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Menu,
  X,
  ArrowUpRight,
  Music,
  BookOpen,
  Image as ImageIcon,
  Radio,
  Cpu,
  Coins,
  Disc3,
} from 'lucide-react';
import BoomerangVideoBg from '@/components/boomerang-video-bg';
import OnAirConsole from '@/components/on-air-console';
import AfroMark from '@/components/afro-mark';

const NAV = [
  { label: 'Catalogue', href: '#catalogue' },
  { label: 'Creators', href: '#creators' },
  { label: 'The Patron Agent', href: '#agent' },
  { label: 'Manifesto', href: '#manifesto' },
];

/** Small mono eyebrow used to head every section. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-volt-light">
      {children}
    </span>
  );
}

const CATALOGUE = [
  {
    code: 'AM-001',
    title: 'Lagos Grooves & Rhythms',
    artist: 'ableton.lagos',
    medium: 'Music',
    icon: Music,
    terms: '$0.0001 / play',
    shares: 'Own from 0.5%',
  },
  {
    code: 'AM-002',
    title: 'Tales of Anansi',
    artist: 'accra.scribe',
    medium: 'Writing',
    icon: BookOpen,
    terms: '$0.001 / read',
    shares: 'One-off cut',
  },
  {
    code: 'AM-003',
    title: 'Egungun Masquerade',
    artist: 'ibadan.frame',
    medium: 'Image',
    icon: ImageIcon,
    terms: '$0.0005 / view',
    shares: 'Own from 1.2%',
  },
];

const STEPS = [
  {
    n: '01',
    head: 'Press the cut',
    body: 'Upload a track, film, story, or image. It is pinned to IPFS and minted as a work NFT on Arc — your master, your name on the label.',
  },
  {
    n: '02',
    head: 'Set the terms',
    body: 'Charge per play, per read, per view, or a one-off unlock. Split every payment with collaborators down to the basis point. Fractionalise if you want the crowd to own a slice.',
  },
  {
    n: '03',
    head: 'Get paid every play',
    body: 'USDC lands in your wallet the moment someone listens — settled on Arc in under half a second. 1% flows to your fan DAO treasury. No label, no 90-day wait.',
  },
];

export default function Landing() {
  const { authenticated } = usePrivy();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Forward into the workspace only right after a fresh login — authenticated
  // visitors can still browse the landing freely (no auto-redirect lock-in).
  const { login } = useLogin({ onComplete: () => router.push('/app') });

  const enter = () => (authenticated ? router.push('/app') : login());

  return (
    <div className="relative bg-ink">
      {/* ── Persistent header ──────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-30 px-4 pt-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/8 bg-ink/40 px-4 py-2.5 backdrop-blur-md">
          <a href="#top" className="flex items-center gap-2.5">
            <AfroMark size={22} className="text-ember" />
            <span className="font-display text-xl font-bold lowercase tracking-tight">
              <span className="text-ember">afro</span><span className="text-volt">meet</span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="font-display text-sm font-medium tracking-wide text-white/70 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={enter}
              className="flex items-center gap-1.5 rounded-xl bg-bone px-4 py-2 text-sm text-ink transition-transform duration-200 hover:scale-105 active:scale-95 sm:px-5"
            >
              {authenticated ? 'Enter' : 'Connect'}
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="liquid-glass flex h-9 w-9 items-center justify-center rounded-xl text-bone md:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="liquid-glass mx-auto mt-2 max-w-7xl rounded-2xl p-2 md:hidden">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-4 py-3 font-display text-sm font-medium tracking-wide text-white/90 hover:bg-white/10"
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section id="top" className="grain relative h-screen w-full overflow-hidden">
        <BoomerangVideoBg />
        <div className="pointer-events-none absolute inset-0 z-1 bg-linear-to-b from-ink/70 via-ink/30 to-ink/90" />

        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-4 pt-28 sm:px-8 sm:pt-0">
          <div className="max-w-3xl">
            <span
              className="liquid-glass animate-fade-up delay-1 mb-6 inline-block rounded-lg px-4 py-1.5 font-mono text-xs uppercase tracking-[0.18em] text-white sm:text-sm"
              style={{ background: 'rgba(255, 255, 255, 0.14)' }}
            >
              Transmission 001 · Pan-African underground
            </span>

            <h1 className="animate-fade-up delay-2 text-4xl leading-[1.05] text-bone sm:text-5xl md:text-6xl lg:text-7xl">
              own the cut.
              <br />
              get paid every play.
            </h1>

            <p className="animate-fade-up delay-3 mt-6 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base md:text-lg">
              Africa&apos;s underground — music, film, words, and images — pressed
              onchain. Each work is a cut you can own a slice of; each play sends
              USDC straight to the maker. No gatekeepers, settled on Arc in under
              half a second.
            </p>

            <div className="animate-fade-up delay-4 mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={enter}
                className="rounded-xl bg-bone px-7 py-2.5 text-sm text-ink transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                Enter the press
              </button>
              <a
                href="#catalogue"
                className="liquid-glass rounded-xl px-7 py-2.5 text-center text-sm text-bone transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                Hear the catalogue
              </a>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 z-20 sm:bottom-6 sm:right-6 md:bottom-8 md:right-10">
          <OnAirConsole />
        </div>
      </section>

      {/* ── Catalogue ──────────────────────────────────────── */}
      <section id="catalogue" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <Eyebrow>The catalogue</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight text-bone sm:text-4xl md:text-5xl">
              every work is a cut.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-white/60">
            A rolling press of one-off works from across the continent. Play it by
            the second, unlock it once, or buy a share and earn alongside the maker.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {CATALOGUE.map((w) => {
            const Icon = w.icon;
            return (
              <div
                key={w.code}
                className="glass group flex flex-col justify-between rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
                    {w.code}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60">
                    <Icon className="h-3 w-3 text-volt" /> {w.medium}
                  </span>
                </div>

                <div className="mt-10">
                  <h3 className="text-xl text-bone">{w.title}</h3>
                  <p className="mt-1 font-mono text-xs text-white/45">{w.artist}</p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-4">
                  <span className="font-mono text-sm text-ember">{w.terms}</span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-white/50">
                    {w.shares}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center gap-2 font-mono text-xs text-white/40">
          <Disc3 className="h-4 w-4 text-volt" />
          <button onClick={enter} className="transition-colors hover:text-bone">
            + more pressings inside the press →
          </button>
        </div>
      </section>

      {/* ── Creators ───────────────────────────────────────── */}
      <section
        id="creators"
        className="scroll-mt-24 border-y border-white/8 bg-white/[0.015] py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <Eyebrow>For makers</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl leading-tight text-bone sm:text-4xl md:text-5xl">
            cut your record. keep your masters.
          </h2>

          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="font-mono text-sm text-volt">{s.n}</span>
                <div className="mt-3 h-px w-full bg-white/10" />
                <h3 className="mt-5 text-xl text-bone">{s.head}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{s.body}</p>
              </div>
            ))}
          </div>

          <button
            onClick={enter}
            className="mt-14 inline-flex items-center gap-1.5 rounded-xl bg-bone px-7 py-2.5 text-sm text-ink transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            Open the studio <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </section>

      {/* ── The Patron Agent ───────────────────────────────── */}
      <section id="agent" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Meet Euterpe · always on air</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight text-bone sm:text-4xl md:text-5xl">
              a patron that spends
              <br />
              its own money.
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-white/65">
              <span className="text-bone">Euterpe</span> is AfroMeet&apos;s
              resident selector — an autonomous patron agent with her own onchain
              identity and wallet. She scans the catalogue, pays real discovery
              nanopayments to sample new works, rates them by ear (Claude under
              the hood), and backs the ones she loves by buying vault shares — all
              in USDC, all without a human in the loop.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 font-mono text-xs">
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-white/70">
                <Cpu className="h-3.5 w-3.5 text-ember" /> ERC-8004 identity
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-white/70">
                <Radio className="h-3.5 w-3.5 text-volt" /> Pays to sample
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-white/70">
                <Coins className="h-3.5 w-3.5 text-ember" /> Backs makers in USDC
              </span>
            </div>
          </div>

          {/* Signal card echoing the hero transmitter */}
          <div className="glass-premium relative overflow-hidden rounded-3xl p-8">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-volt" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone">
                Euterpe · selector log
              </span>
            </div>

            <div className="mt-6 space-y-3 font-mono text-[13px] leading-relaxed">
              <p className="text-white/50">
                <span className="text-volt-light">❯</span> Scanning AccessRegistry… 3 works found.
              </p>
              <p className="text-white/50">
                <span className="text-volt-light">❯</span> Paid $0.002 to sample <span className="text-bone">AM-001</span>.
              </p>
              <p className="text-white/50">
                <span className="text-volt-light">❯</span> Euterpe rates it: <span className="text-bone">0.85</span> / 1.00.
              </p>
              <p className="text-ember">
                ✔ Backing maker — bought 500 vault shares for $2.50.
              </p>
            </div>

            <p className="mt-6 border-t border-white/8 pt-4 font-mono text-[10px] uppercase tracking-wider text-white/40">
              Live picks stream on the workspace &amp; the hero transmitter.
            </p>
          </div>
        </div>
      </section>

      {/* ── Manifesto ──────────────────────────────────────── */}
      <section
        id="manifesto"
        className="scroll-mt-24 border-t border-white/8 px-4 py-28 sm:px-8"
      >
        <div className="mx-auto max-w-4xl text-center">
          <Eyebrow>Manifesto</Eyebrow>
          <p className="mt-6 text-3xl leading-[1.15] text-bone sm:text-4xl md:text-5xl">
            the underground never needed a gatekeeper.
            <span className="text-white/40"> it needed a ledger that pays on time.</span>
          </p>
          <p className="mx-auto mt-8 max-w-xl text-sm leading-relaxed text-white/60">
            AfroMeet is built for the makers the platforms round down to zero —
            the ones pressing sound, film, words, and images from Lagos to
            Nairobi to Kinshasa. Own your work. Price it yourself. Get paid the
            second it&apos;s heard.
          </p>
          <button
            onClick={enter}
            className="mt-10 inline-flex items-center gap-1.5 rounded-xl bg-bone px-8 py-3 text-sm text-ink transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            Enter the press <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-white/8 px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <AfroMark size={18} className="text-ember" />
            <span className="font-display text-base font-bold lowercase tracking-tight">
              <span className="text-ember">afro</span><span className="text-volt">meet</span>
            </span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 font-mono text-[11px] uppercase tracking-wider text-white/40">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-bone">
                {item.label}
              </a>
            ))}
          </nav>
          <span className="font-mono text-[11px] text-white/30">
            © 2026 · Settled on Arc
          </span>
        </div>
      </footer>
    </div>
  );
}
