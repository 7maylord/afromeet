import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/**
 * Pins a creator's work + metadata to IPFS via Pinata (JWT kept server-side). Returns the
 * tokenURI the client then mints with `AfroMeetNFT.mintWork`.
 */
@Injectable()
export class WorksService {
  constructor(private readonly config: ConfigService) {}

  private jwt(): string {
    const jwt = this.config.get<string>('pinataJwt');
    if (!jwt) throw new BadRequestException('PINATA_JWT not configured');
    return jwt;
  }

  async upload(
    file: UploadedFile,
    fields: { title: string; description?: string; category?: string },
  ): Promise<{ metadataUri: string; metadataCid: string; mediaUri: string }> {
    if (!file?.buffer) throw new BadRequestException('file is required');
    const jwt = this.jwt();
    const gateway = this.config.get<string>('ipfsGateway')!;

    // 1. Pin the media file.
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );
    const fileRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
    if (!fileRes.ok) throw new BadRequestException(`Pinata file pin failed: ${await fileRes.text()}`);
    const mediaCid = ((await fileRes.json()) as { IpfsHash: string }).IpfsHash;

    // 2. Build + pin the public preview metadata (the tokenURI).
    const metadata: Record<string, unknown> = {
      name: fields.title,
      description: fields.description ?? '',
      category: fields.category ?? '',
      mediaType: file.mimetype,
      image: gateway + mediaCid,
      url: gateway + mediaCid,
      created: new Date().toISOString(),
    };
    if (fields.category === 'writing') metadata.content = file.buffer.toString('utf8');

    const jsonRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinataContent: metadata }),
    });
    if (!jsonRes.ok) throw new BadRequestException(`Pinata JSON pin failed: ${await jsonRes.text()}`);
    const metadataCid = ((await jsonRes.json()) as { IpfsHash: string }).IpfsHash;

    return {
      metadataUri: `ipfs://${metadataCid}`,
      metadataCid,
      mediaUri: `ipfs://${mediaCid}`,
    };
  }
}
