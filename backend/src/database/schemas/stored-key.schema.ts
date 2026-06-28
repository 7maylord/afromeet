import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoredKeyDocument = HydratedDocument<StoredKey>;

/** An AES key for an encrypted work — keyed by uploadId (pre-mint) then tokenId (post-mint). */
@Schema({ collection: 'media_keys' })
export class StoredKey {
  @Prop({ required: true, index: true }) ref!: string; // uploadId or tokenId
  @Prop({ required: true }) kind!: 'upload' | 'token';
  @Prop({ required: true }) keyHex!: string;
  @Prop({ required: true }) ivHex!: string;
  @Prop({ required: true }) cipherCid!: string;
  @Prop({ required: true }) mediaType!: string;
}

export const StoredKeySchema = SchemaFactory.createForClass(StoredKey);
StoredKeySchema.index({ ref: 1, kind: 1 }, { unique: true });
