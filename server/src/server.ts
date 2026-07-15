import { buildApp } from './app';
import { env } from './config/env';
import { configureCloudinary } from './plugins/cloudinary';
import { connectMongoDb, disconnectMongoDb } from './database/mongodb';
import { connectRedis, disconnectRedis } from './database/redis';
import { createSocketServer } from './socket/socket-server';
import { startDisappearingMessagesCleanup, stopDisappearingMessagesCleanup } from './features/messages/services/message.service';

const startServer = async (): Promise<void> => {
  configureCloudinary();
  await connectMongoDb();
  await connectRedis();
  startDisappearingMessagesCleanup();

  const app = await buildApp();
  const io = createSocketServer(app.server);

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Shutdown signal received');
    stopDisappearingMessagesCleanup();
    await io.close();
    await app.close();
    await disconnectRedis();
    await disconnectMongoDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error, 'Failed to start Ghost API');
    await disconnectRedis();
    await disconnectMongoDb();
    process.exit(1);
  }
};

void startServer();
