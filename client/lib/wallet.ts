'use client';

import { ethers } from 'ethers';

const ARC_CHAIN_ID = 5042002;
const ARC_HEX = '0x' + ARC_CHAIN_ID.toString(16);
const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? '';

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
interface WalletLike {
  getEthereumProvider: () => Promise<Eip1193>;
}

/**
 * Ensure the wallet is on Arc Testnet — switch to it, first adding the network if the wallet
 * doesn't know it yet. No-ops when already on Arc (the common case for Privy embedded wallets).
 */
export async function ensureArcNetwork(provider: Eip1193): Promise<void> {
  const chainId = (await provider.request({ method: 'eth_chainId' })) as string;
  if (parseInt(chainId, 16) === ARC_CHAIN_ID) return;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_HEX }] });
  } catch (err) {
    const e = err as { code?: number; message?: string };
    // 4902 (or an "unrecognized chain" message) → the wallet hasn't added Arc; add it, then switch.
    if (e?.code === 4902 || /unrecognized|not.*added|add this network/i.test(e?.message ?? '')) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: ARC_HEX,
            chainName: 'Arc Testnet',
            nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
            rpcUrls: ARC_RPC ? [ARC_RPC] : [],
            blockExplorerUrls: ['https://testnet.arcscan.app'],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

/** Ensure the wallet is on Arc, then return a signer bound to it. Use everywhere before a tx. */
export async function getArcSigner(wallet: WalletLike): Promise<ethers.Signer> {
  const eip1193 = await wallet.getEthereumProvider();
  await ensureArcNetwork(eip1193);
  const provider = new ethers.BrowserProvider(eip1193 as ethers.Eip1193Provider);
  return provider.getSigner();
}

/**
 * Approve `spender` for `token` only when the current allowance is short — and when it is, approve
 * the max once. Avoids prompting the user for approval on every single purchase.
 */
export async function ensureAllowance(
  signer: ethers.Signer,
  token: string,
  spender: string,
  needed: bigint,
): Promise<void> {
  const owner = await signer.getAddress();
  const erc20 = new ethers.Contract(
    token,
    [
      'function allowance(address,address) view returns (uint256)',
      'function approve(address,uint256) returns (bool)',
    ],
    signer,
  );
  const current = (await erc20.allowance(owner, spender)) as bigint;
  if (current >= needed) return; // already approved enough — no prompt
  const tx = await erc20.approve(spender, ethers.MaxUint256);
  await tx.wait();
}

/**
 * ERC20Votes tokens (VIBE) only count a holder's balance as voting/proposing power once they've
 * delegated — merely holding the token isn't enough. Most holders never realise this and hit a
 * confusing "insufficient votes" revert despite a healthy balance. Delegate to self once, only if
 * never delegated before (a holder who deliberately delegated elsewhere is left alone).
 */
export async function ensureSelfDelegated(signer: ethers.Signer, token: string): Promise<void> {
  const owner = await signer.getAddress();
  const votes = new ethers.Contract(
    token,
    ['function delegates(address) view returns (address)', 'function delegate(address)'],
    signer,
  );
  const current = (await votes.delegates(owner)) as string;
  if (current !== ethers.ZeroAddress) return; // already delegated (to self or elsewhere) — leave it
  const tx = await votes.delegate(owner);
  await tx.wait();
}
