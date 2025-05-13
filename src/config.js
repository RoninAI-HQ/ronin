import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Since __dirname is not available in ES modules, we derive it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Adjusted path to point to project root .env
dotenv.config();

export const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error(
    'Error: ANTHROPIC_API_KEY not found. Please create a .env file in the project root with your API key (e.g., ANTHROPIC_API_KEY=your_key_here)'
  );
  process.exit(1); // Exit if API key is not found
}

// No default export, only named export for apiKey 