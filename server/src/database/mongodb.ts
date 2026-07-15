import mongoose from 'mongoose';

import { env } from '../config/env';

export const connectMongoDb = async (): Promise<typeof mongoose> => {
  mongoose.set('strictQuery', true);

  return mongoose.connect(env.MONGO_URI, {
    autoIndex: env.NODE_ENV !== 'production',
  });
};

export const disconnectMongoDb = async (): Promise<void> => {
  await mongoose.disconnect();
};
