import { Global, Module } from '@nestjs/common';
import { MediaVaultService } from './media-vault.service';

@Global()
@Module({
  providers: [MediaVaultService],
  exports: [MediaVaultService],
})
export class MediaVaultModule {}
