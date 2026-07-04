"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

// Custom Arc Testnet chain configuration for Privy
export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? ''],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
};

export function Providers({ children }: { children: ReactNode }) {
  // Use user-provided Privy App ID or a local fallback for development
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "wallet", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#D97706", // Gold accent
          logo: "/afromeet-logo.jpg",
          showWalletLoginFirst: true,
        },
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
