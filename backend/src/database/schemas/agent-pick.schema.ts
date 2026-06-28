import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AgentPickDocument = HydratedDocument<AgentPick>;

/** A work the agent liked — the persisted recommendation feed. */
@Schema({ collection: 'agent_picks' })
export class AgentPick {
  @Prop({ required: true }) tokenId!: string;
  @Prop() creator!: string;
  @Prop() contentUri!: string;
  @Prop() score!: number;
  @Prop() note!: string;
  @Prop() paidUsdc!: number;
  @Prop({ type: String, default: null }) accessTx!: string | null;
  @Prop() backed!: boolean;
  @Prop({ required: true }) at!: string;
}

export const AgentPickSchema = SchemaFactory.createForClass(AgentPick);
