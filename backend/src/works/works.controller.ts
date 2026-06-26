import { Body, Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorksService } from './works.service';

@ApiTags('works')
@Controller('works')
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @ApiOperation({ summary: 'Encrypt + pin a work to IPFS; returns the tokenURI + uploadId to mint' })
  @ApiConsumes('multipart/form-data')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Body() body: { title: string; description?: string; category?: string },
  ) {
    return this.works.upload(file, body);
  }

  @ApiOperation({ summary: 'Bind the encrypted upload to the minted tokenId (post-mint)' })
  @Post(':tokenId/link')
  link(@Param('tokenId') tokenId: string, @Body() body: { uploadId: string }) {
    return this.works.link(body.uploadId, tokenId);
  }
}
