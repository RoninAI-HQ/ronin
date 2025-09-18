import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

export class ConfigService {
  constructor() {
    this.apiKey = null;
    this.configPath = null;
    this.mcpConfig = null;
    this.llmConfig = null;
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

    // Load LLM configuration
    this.loadLLMConfig();
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

          // Loaded MCP configuration
          return;
        } catch (error) {
          // Failed to parse MCP config
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

  loadLLMConfig() {
    // Check for LLM provider configuration
    const provider = process.env.LLM_PROVIDER || 'anthropic';

    this.llmConfig = {
      provider: provider,
      anthropicApiKey: this.apiKey,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:3b',
      // Inline LLM configuration
      inlineModelPath: process.env.INLINE_MODEL_PATH || null,
      inlineModelName: process.env.INLINE_MODEL_NAME || 'llama3.2-3b-instruct',
      inlineModelsDir: process.env.INLINE_MODELS_DIR || path.join(os.homedir(), '.ronin', 'models'),
      contextSize: parseInt(process.env.CONTEXT_SIZE) || 4096,
      gpuLayers: process.env.GPU_LAYERS || 'auto',
      maxTokens: parseInt(process.env.MAX_TOKENS) || 2048,
      temperature: parseFloat(process.env.TEMPERATURE) || 0.7
    };

    // Try to load from a config file if it exists
    const homeDir = os.homedir();
    const llmConfigPaths = [
      path.join(homeDir, '.ronin', 'llm.json'),
      path.resolve(process.cwd(), 'llm.json')
    ];

    for (const configPath of llmConfigPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const configContent = fs.readFileSync(configPath, 'utf-8');
          const fileConfig = JSON.parse(configContent);
          this.llmConfig = { ...this.llmConfig, ...fileConfig };
          // Loaded LLM configuration
          break;
        } catch (error) {
          // Failed to parse LLM config
        }
      }
    }

    if (this.llmConfig.provider === 'ollama') {
      // LLM Provider: Ollama
    } else if (this.llmConfig.provider === 'inline-llm') {
      // LLM Provider: Inline Local LLM
    } else {
      // LLM Provider: Anthropic Claude
    }
  }

  getLLMConfig() {
    return this.llmConfig;
  }

  setLLMProvider(provider, config = {}) {
    this.llmConfig = {
      ...this.llmConfig,
      provider,
      ...config
    };
  }
}