import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "AfroMeet — West African Creative Ownership",
  description: "From NFT drops to per-access royalties — every play, view, and read, every USDC settled.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-white font-poppins">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

