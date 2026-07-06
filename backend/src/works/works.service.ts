import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { MediaVaultService } from '../media-vault/media-vault.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ethers } from 'ethers';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/**
 * Encrypts a creator's work (AES-256-GCM), pins the **ciphertext** to IPFS, and stashes the key in
 * the MediaVault. The public metadata (tokenURI) carries only the preview + the ciphertext CID — never
 * the key. The key is released later by AccessService, only after the x402 payment is verified.
 */
@Injectable()
export class WorksService {
  constructor(
    private readonly vault: MediaVaultService,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {}

  private jwt(): string {
    const jwt = this.config.get<string>('pinataJwt');
    if (!jwt) throw new BadRequestException('PINATA_JWT not configured');
    return jwt;
  }

  private async pinFile(jwt: string, bytes: Buffer, name: string): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }), name);
    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
    if (!res.ok) throw new BadRequestException(`Pinata file pin failed: ${await res.text()}`);
    return ((await res.json()) as { IpfsHash: string }).IpfsHash;
  }

  private async pinJson(jwt: string, content: unknown): Promise<string> {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinataContent: content }),
    });
    if (!res.ok) throw new BadRequestException(`Pinata JSON pin failed: ${await res.text()}`);
    return ((await res.json()) as { IpfsHash: string }).IpfsHash;
  }

  async upload(
    file: UploadedFile,
    fields: { title: string; description?: string; category?: string },
  ): Promise<{ metadataUri: string; metadataCid: string; uploadId: string; cipherCid: string }> {
    if (!file?.buffer) throw new BadRequestException('file is required');
    const jwt = this.jwt();

    // 1. Encrypt the master. Append the GCM auth tag so WebCrypto can decrypt it client-side.
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(file.buffer), cipher.final()]);
    const ciphertext = Buffer.concat([enc, cipher.getAuthTag()]);

    // 2. Pin the ciphertext (public IPFS — encrypted, so safe).
    const cipherCid = await this.pinFile(jwt, ciphertext, `${file.originalname}.enc`);

    // 3. Public preview metadata — NO key, NO plaintext.
    const metadataCid = await this.pinJson(jwt, {
      name: fields.title,
      description: fields.description ?? '',
      category: fields.category ?? '',
      mediaType: file.mimetype,
      encrypted: true,
      cipherCid,
      created: new Date().toISOString(),
    });

    // 4. Stash the key against a transient uploadId (linked to the tokenId after mint).
    const uploadId = randomUUID();
    await this.vault.stash(uploadId, {
      keyHex: key.toString('hex'),
      ivHex: iv.toString('hex'),
      cipherCid,
      mediaType: file.mimetype,
    });

    return { metadataUri: `ipfs://${metadataCid}`, metadataCid, uploadId, cipherCid };
  }

  /** After mint, bind the stashed key to the real tokenId. */
  async link(uploadId: string, tokenId: string, signature: string): Promise<{ cipherCid: string }> {
    const creator = await this.blockchain.getCreator(tokenId);
    const signer = ethers.verifyMessage(`AfroMeet link ${tokenId} ${uploadId}`, signature);
    if (signer.toLowerCase() !== creator.toLowerCase()) {
      throw new BadRequestException('link signature is not from the work creator');
    }
    return { cipherCid: await this.vault.link(uploadId, tokenId) };
  }
}
