import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

export class ConfigService {
  constructor() {
    this.apiKey = null;
    this.configPath = null;
    this.mcpConfig = null;
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

    // Load MCP configuration
    this.loadMCPConfig();
  }

  loadMCPConfig() {
    const homeDir = os.homedir();
    const mcpConfigPaths = [
      path.join(homeDir, '.ronin', 'mcp.json'),
      path.resolve(process.cwd(), 'mcp.json'),
      path.join(homeDir, '.ronin', 'ronin-mcp.json'),
      path.resolve(process.cwd(), 'ronin-mcp.json')
    ];

    for (const configPath of mcpConfigPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const configContent = fs.readFileSync(configPath, 'utf-8');
          const parsedConfig = JSON.parse(configContent);

          // Handle both 'servers' and 'mcpServers' formats
          if (parsedConfig.servers) {
            this.mcpConfig = parsedConfig;
          } else if (parsedConfig.mcpServers) {
            this.mcpConfig = { servers: parsedConfig.mcpServers };
          } else {
            this.mcpConfig = { servers: parsedConfig };
          }

          // Always ensure built-in server is available if not explicitly disabled
          if (!this.mcpConfig.servers.builtin) {
            this.mcpConfig.servers.builtin = {
              enabled: true,
              tools: ['file_read', 'file_write', 'file_list', 'shell_execute', 'web_request']
            };
          }

          return;
        } catch (error) {
          console.error(`[Config] Failed to parse MCP config from ${configPath}:`, error.message);
        }
      }
    }

    // Default MCP configuration if no file found
    this.mcpConfig = {
      servers: {
        builtin: {
          enabled: true,
          tools: ['file_read', 'file_write', 'file_list', 'shell_execute', 'web_request']
        }
      }
    };
  }

  getApiKey() {
    return this.apiKey;
  }

  getConfigPath() {
    return this.configPath;
  }

  getMCPConfig() {
    return this.mcpConfig;
  }

  saveMCPConfig(config) {
    // Find the MCP config file path
    const mcpConfigPaths = [
      path.resolve(process.cwd(), 'mcp.json'),
      path.join(os.homedir(), '.ronin', 'mcp.json'),
      path.resolve(process.cwd(), 'ronin-mcp.json'),
      path.join(os.homedir(), '.ronin', 'ronin-mcp.json')
    ];

    // Use the first existing path, or default to mcp.json in current directory
    let configPath = mcpConfigPaths.find(p => fs.existsSync(p)) || mcpConfigPaths[0];

    try {
      // Ensure directory exists if it's in .ronin folder
      if (configPath.includes('.ronin')) {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // Write the configuration
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.mcpConfig = config;
      return configPath;
    } catch (error) {
      throw new Error(`Failed to save MCP configuration: ${error.message}`);
    }
  }

  reloadMCPConfig() {
    this.loadMCPConfig();
  }
}