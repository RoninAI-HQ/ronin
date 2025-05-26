import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

export class ConfigService {
  constructor() {
    this.apiKey = null;
    this.configPath = null;
  }

  loadConfig() {
    const homeDir = os.homedir();
    const primaryConfigPath = path.join(homeDir, '.ronin', 'ronin.config');
    const fallbackConfigPath = path.resolve(process.cwd(), 'ronin.config');

    if (fs.existsSync(primaryConfigPath)) {
      this.configPath = primaryConfigPath;
    } else if (fs.existsSync(fallbackConfigPath)) {
      this.configPath = fallbackConfigPath;
    }

    if (this.configPath) {
      dotenv.config({ path: this.configPath });
    }

    // Load from any .env file as well
    dotenv.config();

    this.apiKey = process.env.ANTHROPIC_API_KEY;

    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found. Please create a .env file or ronin.config with your API key');
    }
  }

  getApiKey() {
    return this.apiKey;
  }

  getConfigPath() {
    return this.configPath;
  }
}