import { connectDB } from './config/db.js';
import redis from './config/redis.js';
import mongoose from 'mongoose';

const verifyInfrastructure = async () => {
  try {
    console.log('Verifying MongoDB Connection...');
    await connectDB();
    // Ping MongoDB to ensure it's fully active
    if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
    }
    console.log('\x1b[32m%s\x1b[0m', '✅ MongoDB Verification Passed');

    console.log('Verifying Redis Connection...');
    await redis.set('cortex:test', 'success', 'EX', 10);
    const testKey = await redis.get('cortex:test');
    
    if (testKey !== 'success') {
      throw new Error('Redis verification failed: value mismatch');
    }
    console.log('\x1b[32m%s\x1b[0m', '✅ Redis Verification Passed');

    console.log('\x1b[36m%s\x1b[0m', '🚀 All infrastructure connections are healthy!');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Verification Failed:');
    console.error((error as Error).stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    redis.disconnect();
    process.exit(0);
  }
};

verifyInfrastructure();
