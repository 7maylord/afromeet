import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StoredKey, StoredKeyDocument } from '../database/schemas/stored-key.schema';

export interface MediaKey {
  keyHex: string; // AES-256 key
  ivHex: string; // GCM nonce
  cipherCid: string; // IPFS CID of the ciphertext (safe to publish — useless without the key)
  mediaType: string;
}

/**
 * Holds the AES decryption keys for encrypted works. The ciphertext lives on public IPFS; the key
 * is only ever released by AccessService **after** payment is verified. Keyed first by a transient
 * uploadId (pre-mint), then re-keyed to the tokenId once the work is minted.
 *
 * Persisted to MongoDB when MONGODB_URI is set; otherwise in-memory (resets on restart).
 */
@Injectable()
export class MediaVaultService {
  private readonly byUpload = new Map<string, MediaKey>();
  private readonly byToken = new Map<string, MediaKey>();

  constructor(
    @Optional() @InjectModel(StoredKey.name) private readonly model?: Model<StoredKeyDocument>,
  ) {}

  async stash(uploadId: string, rec: MediaKey): Promise<void> {
    if (this.model) {
      await this.model.updateOne(
        { ref: uploadId, kind: 'upload' },
        { $set: { ...rec, ref: uploadId, kind: 'upload' } },
        { upsert: true },
      );
    } else {
      this.byUpload.set(uploadId, rec);
    }
  }

  /** After mint: associate the stashed key with the real tokenId. */
  async link(uploadId: string, tokenId: string): Promise<string> {
    if (this.model) {
      const doc = await this.model.findOne({ ref: uploadId, kind: 'upload' }).lean();
      if (!doc) throw new NotFoundException('unknown or expired uploadId');
      await this.model.updateOne(
        { ref: tokenId, kind: 'token' },
        {
          $set: {
            ref: tokenId,
            kind: 'token',
            keyHex: doc.keyHex,
            ivHex: doc.ivHex,
            cipherCid: doc.cipherCid,
            mediaType: doc.mediaType,
          },
        },
        { upsert: true },
      );
      await this.model.deleteOne({ ref: uploadId, kind: 'upload' });
      return doc.cipherCid;
    }
    const rec = this.byUpload.get(uploadId);
    if (!rec) throw new NotFoundException('unknown or expired uploadId');
    this.byToken.set(tokenId, rec);
    this.byUpload.delete(uploadId);
    return rec.cipherCid;
  }

  async get(tokenId: string): Promise<MediaKey | undefined> {
    if (this.model) {
      const doc = await this.model.findOne({ ref: tokenId, kind: 'token' }).lean();
      return doc
        ? { keyHex: doc.keyHex, ivHex: doc.ivHex, cipherCid: doc.cipherCid, mediaType: doc.mediaType }
        : undefined;
    }
    return this.byToken.get(tokenId);
  }
}
