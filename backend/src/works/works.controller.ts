import { Body, Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WorksService } from './works.service';

@ApiTags('works')
@Controller('works')
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @ApiOperation({ summary: 'Encrypt + pin a work to IPFS; returns the tokenURI + uploadId to mint' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'The media file (audio, video, image, document)' },
        title: { type: 'string', example: 'Lagos Grooves Vol. 1' },
        description: { type: 'string', example: 'Afrobeats from the mainland' },
        category: { type: 'string', example: 'music', enum: ['music', 'video', 'writing', 'image'] },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'uploadId (pass to /link after minting) + tokenURI (metadata IPFS CID to pass to mint())',
  })
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Body() body: { title: string; description?: string; category?: string },
  ) {
    return this.works.upload(file, body);
  }

  @ApiOperation({ summary: 'Bind the encrypted upload to the minted tokenId (post-mint)' })
  @ApiParam({ name: 'tokenId', description: 'NFT token ID returned by the mint tx', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['uploadId'],
      properties: {
        uploadId: { type: 'string', example: 'upload_abc123', description: 'uploadId returned by /works/upload' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'ok: true — decryption key is now bound to the token' })
  @Post(':tokenId/link')
  link(@Param('tokenId') tokenId: string, @Body() body: { uploadId: string }) {
    return this.works.link(body.uploadId, tokenId);
  }
}
