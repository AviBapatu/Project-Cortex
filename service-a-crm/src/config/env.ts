import dotenv from 'dotenv';

dotenv.config();

const requiredVariables = [
  'PORT',
  'MONGO_URI',
  'REDIS_HOST',
  'REDIS_PORT',
  'NODE_ENV',
  'GROQ_API_KEY',
  'GOOGLE_API_KEY',
];

const missingVariables = requiredVariables.filter((key) => !process.env[key]);

if (missingVariables.length > 0) {
  console.error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  process.exit(1);
}

export const config = {
  PORT: process.env.PORT as string,
  MONGO_URI: process.env.MONGO_URI as string,
  REDIS_HOST: process.env.REDIS_HOST as string,
  REDIS_PORT: parseInt(process.env.REDIS_PORT as string, 10),
  REDIS_USERNAME: process.env.REDIS_USERNAME as string | undefined,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD as string | undefined,
  NODE_ENV: process.env.NODE_ENV as string,
  GROQ_API_KEY: process.env.GROQ_API_KEY as string,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY as string,
};
