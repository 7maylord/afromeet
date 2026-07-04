import type { Metadata } from "next";
import { Space_Mono, Syne } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

// Display face for the wordmark + nav — a distinctive art/culture grotesque.
const syne = Syne({
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "AfroMeet — Africa's underground, pressed onchain",
  description:
    "Own the cut, get paid every play. Music, film, words, and images from Africa's underground — each work a share you can own, each play a USDC payment straight to the maker. Settled on Arc.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${syne.variable} h-full antialiased`}>
      <head>
        <link
          rel="stylesheet"
          href="https://db.onlinewebfonts.com/c/a64ff11d2c24584c767f6257e880dc65?family=Helvetica+Regular"
        />
      </head>
      <body className="min-h-full flex flex-col bg-ink text-bone">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
