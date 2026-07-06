import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UsedPaymentDocument = HydratedDocument<UsedPayment>;

@Schema({ collection: 'used_payments', timestamps: true })
export class UsedPayment {
  @Prop({ required: true, unique: true }) txHash!: string;
}

export const UsedPaymentSchema = SchemaFactory.createForClass(UsedPayment);
