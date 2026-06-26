import { Injectable, NotFoundException } from '@nestjs/common';

export interface MediaKey {
  keyHex: string; // AES-256 key
  ivHex: string; // GCM nonce
  cipherCid: string; // IPFS CID of the ciphertext (safe to publish — useless without the key)
  mediaType: string;
}

/**
 * Holds the AES decryption keys for encrypted works. The ciphertext lives on public IPFS; the key
 * is only ever released by AccessService **after** the x402 payment is verified. Keyed first by a
 * transient uploadId (mint hasn't happened yet), then re-keyed to the tokenId once the work is minted.
 *
 * In-memory for the hackathon — keys reset on restart. A KMS / encrypted DB would persist them.
 */
@Injectable()
export class MediaVaultService {
  private readonly byUpload = new Map<string, MediaKey>();
  private readonly byToken = new Map<string, MediaKey>();

  stash(uploadId: string, rec: MediaKey): void {
    this.byUpload.set(uploadId, rec);
  }

  /** After mint: associate the stashed key with the real tokenId. */
  link(uploadId: string, tokenId: string): string {
    const rec = this.byUpload.get(uploadId);
    if (!rec) throw new NotFoundException('unknown or expired uploadId');
    this.byToken.set(tokenId, rec);
    this.byUpload.delete(uploadId);
    return rec.cipherCid;
  }

  get(tokenId: string): MediaKey | undefined {
    return this.byToken.get(tokenId);
  }
}
