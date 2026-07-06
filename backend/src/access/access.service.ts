import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { BlockchainService } from '../blockchain/blockchain.service';
import { WalletsService } from '../circle/wallets.service';
import { MediaVaultService } from '../media-vault/media-vault.service';

@Injectable()
export class AccessService {
  /** Resolved work metadata, cached by tokenURI (IPFS CIDs are immutable). */
  private readonly metaCache = new Map<string, { title: string | null; category: string | null }>();
  private readonly usedSessionProofs = new Set<string>();

  constructor(
    private readonly blockchain: BlockchainService,
    private readonly wallets: WalletsService,
    private readonly config: ConfigService,
    private readonly vault: MediaVaultService,
  ) {}

  private ipfsToHttp(uri: string): string {
    const gw = this.config.get<string>('ipfsGateway')!;
    return uri?.startsWith('ipfs://') ? gw + uri.slice(7) : uri;
  }

  /** Fetch a work's public metadata (title + category) server-side, so the client never has to
   *  reach IPFS itself. Cached on success; failures fall through to null and retry next time. */
  private async resolveMeta(tokenURI: string): Promise<{ title: string | null; category: string | null }> {
    const cached = this.metaCache.get(tokenURI);
    if (cached) return cached;
    try {
      const res = await fetch(this.ipfsToHttp(tokenURI), { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const meta = (await res.json()) as { name?: string; category?: string };
        const out = { title: meta?.name ?? null, category: meta?.category ?? null };
        this.metaCache.set(tokenURI, out);
        return out;
      }
    } catch {
      /* metadata unreachable — leave null, don't cache so it retries */
    }
    return { title: null, category: null };
  }

  /** The public catalogue: every active work on-chain with its pricing, tokenURI, title + vault state. */
  async catalogue() {
    const next = Number(await this.blockchain.getNextTokenId());
    const nftAddr = this.blockchain.nftAddress();
    const works: unknown[] = [];
    for (let id = 1; id <= next; id++) {
      try {
        const cfg = await this.blockchain.getAccessConfig(id);
        if (!cfg.active) continue;
        const [creator, uri] = await Promise.all([
          this.blockchain.getCreator(id),
          this.blockchain.getTokenUri(id),
        ]);
        const meta = await this.resolveMeta(uri);

        let vault: string | null = null;
        let sharePriceRaw = '0';
        let sharesForSale = 0;
        let totalShares = 0;
        let curator: string | null = null;
        try {
          const v = await this.blockchain.getVaultOf(nftAddr, id);
          if (v && v !== ethers.ZeroAddress) {
            vault = v;
            const info = await this.blockchain.getSaleInfo(v);
            curator = info.curator;
            sharePriceRaw = info.pricePerShare.toString();
            sharesForSale = Number(info.sharesForSale);
            totalShares = Number(info.totalShares);
          }
        } catch {
          /* no vault for this token */
        }

        works.push({
          id: id.toString(),
          creator,
          title: meta.title ?? `Work #${id}`,
          category: meta.category,
          mode: cfg.mode === 0 ? 'TIMED' : 'DISCRETE',
          pricePerAccessUsdc: Number(cfg.pricePerAccess) / 1e6,
          discoveryPriceUsdc: Number(cfg.discoveryPrice) / 1e6,
          ratePerSecondUsdc: Number(cfg.ratePerSecond) / 1e6,
          minAccessSeconds: Number(cfg.minAccessSeconds),
          tokenURI: uri,
          vault,
          sharePriceRaw,
          sharesForSale,
          totalShares,
          curator,
        });
      } catch {
        /* skip unreadable token */
      }
    }
    return works;
  }

  /** Public access config for a work (rate, discovery price, mode, creator). */
  async getConfig(tokenId: string) {
    const [cfg, creator] = await Promise.all([
      this.blockchain.getAccessConfig(tokenId),
      this.blockchain.getCreator(tokenId),
    ]);
    return {
      tokenId,
      creator,
      pricePerAccess: cfg.pricePerAccess.toString(),
      discoveryPrice: cfg.discoveryPrice.toString(),
      ratePerSecond: cfg.ratePerSecond.toString(),
      mode: cfg.mode === 0 ? 'TIMED' : 'DISCRETE',
      minAccessSeconds: Number(cfg.minAccessSeconds),
      daoTreasury: cfg.daoTreasury,
      active: cfg.active,
    };
  }

  /** Live accrued cost for a TIMED work after `elapsedSeconds` of playback (for the ticking meter). */
  async heartbeat(tokenId: string, elapsedSeconds: number) {
    const cfg = await this.blockchain.getAccessConfig(tokenId);
    const accruedRaw = BigInt(Math.max(0, Math.floor(elapsedSeconds))) * cfg.ratePerSecond;
    return {
      tokenId,
      elapsedSeconds,
      ratePerSecondUsdc: Number(cfg.ratePerSecond) / 1e6,
      accruedUsdc: Number(accruedRaw) / 1e6,
      belowMin: elapsedSeconds < Number(cfg.minAccessSeconds),
    };
  }

  /**
   * Released ONLY after the NanopaymentGuard verifies the discovery payment (non-holders).
   * Encrypted works return the ciphertext URL + AES key/iv for the client to decrypt locally.
   */
  async getContent(tokenId: string) {
    return this.releaseContent(tokenId);
  }

  /**
   * Holder/streaming path: releases the key for a work given a valid open (unsettled) session.
   *
   * DISCRETE works (flat one-time price, no metering) settle immediately, before release — pay
   * then view. TIMED works release the key unsettled and are billed later via `settle()` for the
   * real elapsed listening time (see the /access/session/settle endpoint, called on stop); the
   * contract's minAccessSeconds skip-gate makes anything below that threshold a free preview.
   */
  async sessionContent(sessionId: string) {
    const s = await this.blockchain.getSession(sessionId);
    if (s.listener === ethers.ZeroAddress || s.settled) {
      throw new ForbiddenException('no open session for this content');
    }
    const cfg = await this.blockchain.getAccessConfig(s.tokenId);
    if (cfg.mode !== 0) {
      // DISCRETE: flat price, no elapsed-time concept — settle now, before releasing the key.
      const calldata = this.blockchain.encodeSettle(sessionId, 0);
      const txId = await this.wallets.sendContractCall(this.escrowAddress(), calldata);
      await this.wallets.waitForTransaction(txId);
    }
    return this.releaseContent(s.tokenId.toString());
  }

  /** Returns decryption material for encrypted works, or the plain tokenURI for legacy works. */
  private async releaseContent(tokenId: string) {
    const gateway = this.config.get<string>('ipfsGateway')!;
    const rec = await this.vault.get(tokenId);
    if (rec) {
      return {
        tokenId,
        encrypted: true,
        cipherUrl: gateway + rec.cipherCid,
        key: rec.keyHex,
        iv: rec.ivHex,
        mediaType: rec.mediaType,
      };
    }
    const uri = await this.blockchain.getTokenUri(tokenId);
    const url = uri.startsWith('ipfs://') ? gateway + uri.slice('ipfs://'.length) : uri;
    return { tokenId, encrypted: false, uri, url };
  }

  /** Operator opens a metered session against a listener's pre-authorised USDC. */
  async openSession(tokenId: string, listener: string, signature: string, nonce: string, timestamp: number, authorisedUsdc?: number) {
    const escrow = this.escrowAddress();
    if (!ethers.isAddress(listener) || !nonce || Math.abs(Date.now() - timestamp) > 300_000 || this.usedSessionProofs.has(nonce)) {
      throw new BadRequestException('invalid or reused session proof');
    }
    const recovered = ethers.verifyMessage(
      `AfroMeet session ${tokenId} ${listener.toLowerCase()} ${nonce} ${timestamp}`,
      signature,
    );
    if (recovered.toLowerCase() !== listener.toLowerCase()) {
      throw new ForbiddenException('session signature does not match listener');
    }
    this.usedSessionProofs.add(nonce);
    const cfg = await this.blockchain.getAccessConfig(tokenId);
    let authorised: bigint;
    if (authorisedUsdc !== undefined) {
      authorised = BigInt(Math.floor(authorisedUsdc * 1e6));
    } else {
      authorised = cfg.pricePerAccess;
    }
    const minimum = cfg.mode === 0 ? cfg.ratePerSecond * cfg.minAccessSeconds : cfg.pricePerAccess;
    if (authorised < minimum) throw new BadRequestException('authorised amount is below minimum access cost');
    const [allowance, balance] = await Promise.all([
      this.blockchain.usdcAllowance(listener, escrow),
      this.blockchain.usdcBalanceOf(listener),
    ]);
    if (allowance < minimum || balance < minimum) {
      throw new BadRequestException('insufficient USDC allowance or balance');
    }

    const sessionId = ethers.hexlify(ethers.randomBytes(32));
    const calldata = this.blockchain.encodeOpenSession(sessionId, listener, tokenId, authorised);
    const txId = await this.wallets.sendContractCall(escrow, calldata);
    const txHash = await this.wallets.waitForTransaction(txId);
    return { sessionId, txHash, authorised: authorised.toString() };
  }

  /**
   * Operator settles a session for the metered playback duration. TIMED works are charged
   * `elapsedSeconds × ratePerSecond` (capped at the budget); DISCRETE works ignore elapsedSeconds.
   * Distributes per SplitResolver + 1% DAO cut.
   */
  async settle(sessionId: string, elapsedSeconds = 0) {
    const escrow = this.escrowAddress();
    const calldata = this.blockchain.encodeSettle(sessionId, Math.max(0, Math.floor(elapsedSeconds)));
    const txId = await this.wallets.sendContractCall(escrow, calldata);
    const txHash = await this.wallets.waitForTransaction(txId);
    return { sessionId, elapsedSeconds, txHash };
  }

  /**
   * Listener-triggered settlement (e.g. on Stop). `settle()` above is operator-only (internal/ops
   * use); this is the public path a browser calls directly, so it can't take a shared secret —
   * instead it requires the same signature proof as `openSession`, and additionally checks the
   * signer is the actual on-chain listener for this session, so nobody can settle someone else's
   * session or forge a different listener's payment.
   */
  async settleAsListener(
    sessionId: string,
    listener: string,
    signature: string,
    nonce: string,
    timestamp: number,
    elapsedSeconds: number,
  ) {
    if (
      !ethers.isAddress(listener) ||
      !nonce ||
      Math.abs(Date.now() - timestamp) > 300_000 ||
      this.usedSessionProofs.has(nonce)
    ) {
      throw new BadRequestException('invalid or reused settlement proof');
    }
    const recovered = ethers.verifyMessage(
      `AfroMeet settle ${sessionId} ${listener.toLowerCase()} ${nonce} ${timestamp}`,
      signature,
    );
    if (recovered.toLowerCase() !== listener.toLowerCase()) {
      throw new ForbiddenException('settlement signature does not match listener');
    }
    const session = await this.blockchain.getSession(sessionId);
    if (session.listener.toLowerCase() !== listener.toLowerCase()) {
      throw new ForbiddenException('not the listener for this session');
    }
    this.usedSessionProofs.add(nonce);
    return this.settle(sessionId, elapsedSeconds);
  }

  private escrowAddress(): string {
    const escrow = this.config.get<string>('contracts.accessEscrow');
    if (!escrow) throw new BadRequestException('ACCESS_ESCROW_ADDRESS not configured');
    return escrow;
  }
}
