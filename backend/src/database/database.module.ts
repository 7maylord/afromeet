import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoredKey, StoredKeySchema } from './schemas/stored-key.schema';
import { AgentPick, AgentPickSchema } from './schemas/agent-pick.schema';

/**
 * Optional persistence. When MONGODB_URI is set, registers the schemas and exports the models
 * globally; otherwise it's a no-op and the services fall back to in-memory stores (via @Optional).
 */
@Global()
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      new Logger(DatabaseModule.name).warn('MONGODB_URI not set — using in-memory stores');
      return { module: DatabaseModule };
    }
    const features = MongooseModule.forFeature([
      { name: StoredKey.name, schema: StoredKeySchema },
      { name: AgentPick.name, schema: AgentPickSchema },
    ]);
    return {
      module: DatabaseModule,
      imports: [MongooseModule.forRoot(uri), features],
      exports: [features],
    };
  }
}
