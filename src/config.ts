import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiKey: process.env.API_KEY || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  swiftBinaryPath: join(__dirname, 'swift', 'bin', 'reminders-cli'),
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  swiftCommandTimeout: 10000, // 10 seconds
} as const;

// Validate required configuration
if (!config.apiKey) {
  console.error('ERROR: API_KEY is required in .env file');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"');
  process.exit(1);
}

export default config;
