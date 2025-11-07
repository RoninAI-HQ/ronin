import { PermissionCache } from './PermissionCache.js';
import { getLLMProviderManager } from '../api.js';
import { inlineLLMCommands } from './CommandServiceExtensions.js';
import chalk from 'chalk';

export class CommandService {
  constructor(fileService, conversationService, mcpManager = null, configService = null) {
    this.fileService = fileService;
    this.conversationService = conversationService;
    this.mcpManager = mcpManager;
    this.configService = configService;
    this.permissionCache = new PermissionCache();
    this.commands = {
      '/help': this.showHelp.bind(this),
      '/exit': this.exit.bind(this),
      '/quit': this.exit.bind(this),
      '/save': this.saveConversation.bind(this),
      '/export': this.exportConversation.bind(this),
      '/load': this.loadConversation.bind(this),
      '/new': this.newConversation.bind(this),
      '/clear': this.clearScreen.bind(this),
      '/permissions': this.managePermissions.bind(this),
      '/provider': this.switchProvider.bind(this),
      '/models': this.listModels.bind(this),
      '/pull': this.pullModel.bind(this),
      '/download': inlineLLMCommands.downloadModel,
      '/models-available': inlineLLMCommands.listAvailableModels,
      '/model-info': inlineLLMCommands.getModelInfo,
      '/load-model': inlineLLMCommands.loadModel,
      '/unload-model': inlineLLMCommands.unloadModel,
      '/mcp': this.manageMCP.bind(this)
    };
  }

  setConfigService(configService) {
    this.configService = configService;
  }

  isCommand(input) {
    return input.startsWith('/');
  }

  async executeCommand(input) {
    const [command, ...args] = input.split(' ');

    if (command in this.commands) {
      return await this.commands[command](args.join(' '));
    }

    return { type: 'error', message: `Unknown command: ${command}` };
  }

  showHelp() {
    const manager = getLLMProviderManager();
    const currentProvider = manager ? manager.getProviderType() : 'anthropic';

    return {
      type: 'help',
      message: `Available commands:
  /help          - Show this help message.
  /exit, /quit   - Exit the Ronin CLI.
  /save          - Save the current conversation as a Markdown file.
  /export        - Export the current conversation to a JSON file.
  /load list     - List saved conversation files in the current directory.
  /load [path]   - Load a conversation from the specified JSON file.
  /new           - Save current conversation, then start a new one (clears screen and history).
  /clear         - Clear the terminal screen.

Permission management:
  /permissions         - Manage tool permissions.
  /permissions status  - Show permission cache status.
  /permissions clear   - Clear all cached permissions.
  /permissions always  - Enable/disable always-ask mode.

MCP server management:
  /mcp                 - Manage MCP servers.
  /mcp list            - List connected MCP servers.
  /mcp add             - Add a new MCP server.
  /mcp remove [name]   - Remove an MCP server.
  /mcp reload          - Reload MCP configuration.

LLM Provider commands (current: ${currentProvider}):
  /provider      - Show current LLM provider.
  /provider [name] - Switch to specified provider (anthropic, ollama, or inline-llm).
  /models        - List local models.
  /models-available - List recommended models for download.
  /pull [model]  - Pull a new model (Ollama only).
  /download [model] - Download a model (Inline LLM).
  /load-model [name] - Load a specific model (Inline LLM).
  /unload-model  - Unload current model (Inline LLM).
  /model-info    - Show current model information.`
    };
  }

  exit() {
    return { type: 'exit' };
  }

  async saveConversation() {
    try {
      const fileName = await this.fileService.exportConversationAsMarkdown(
        this.conversationService.getHistory()
      );
      return { type: 'success', message: `Conversation saved as Markdown to ${fileName}` };
    } catch (error) {
      return { type: 'error', message: error.message };
    }
  }

  async exportConversation() {
    try {
      const fileName = await this.fileService.saveConversation(
        this.conversationService.getHistory()
      );
      return { type: 'success', message: `Conversation exported as JSON to ${fileName}` };
    } catch (error) {
      return { type: 'error', message: error.message };
    }
  }

  async loadConversation(args) {
    if (!args) {
      return { type: 'error', message: 'Usage: /load list OR /load [filepath]' };
    }

    if (args.toLowerCase() === 'list') {
      try {
        const files = await this.fileService.listConversations();
        if (files.length === 0) {
          return { type: 'info', message: 'No saved conversation files found in the current directory.' };
        }
        return { type: 'list', message: 'Saved conversation files:', items: files };
      } catch (error) {
        return { type: 'error', message: error.message };
      }
    }

    try {
      const history = await this.fileService.loadConversation(args);
      this.conversationService.setHistory(history);

      let preview = '';
      if (history.length > 0) {
        const lastMessage = history[history.length - 1];
        preview = `Last message: [${lastMessage.role}] ${lastMessage.content.substring(0, 50)}...`;
      }

      return {
        type: 'success',
        message: `Conversation loaded from ${args}.`,
        additionalMessage: preview
      };
    } catch (error) {
      return { type: 'error', message: error.message };
    }
  }

  async newConversation() {
    try {
      if (this.conversationService.hasHistory()) {
        const fileName = await this.fileService.saveConversation(
          this.conversationService.getHistory()
        );
      }
      this.conversationService.clearHistory();
      return {
        type: 'new',
        message: 'New conversation started. Previous conversation saved as JSON (if not empty).'
      };
    } catch (error) {
      return { type: 'error', message: `Error saving conversation: ${error.message}` };
    }
  }

  clearScreen() {
    return { type: 'clear', message: 'Screen cleared.' };
  }

  async managePermissions(args) {
    if (!args) {
      return {
        type: 'info',
        message: `Permission management commands:
  /permissions status  - Show permission cache status
  /permissions clear   - Clear all cached permissions
  /permissions always on/off - Enable/disable always-ask mode`
      };
    }

    const [subcommand, ...subargs] = args.split(' ');

    switch (subcommand.toLowerCase()) {
      case 'status':
        const stats = this.permissionCache.getStats();
        return {
          type: 'info',
          message: `Permission Cache Status:
  Total cached approvals: ${stats.totalApprovals}
  Always ask mode: ${stats.alwaysAsk ? 'ON' : 'OFF'}
  Session started: ${stats.sessionStart ? new Date(stats.sessionStart).toLocaleString() : 'Unknown'}`
        };

      case 'clear':
        this.permissionCache.clearCache();
        return {
          type: 'success',
          message: 'All cached permissions have been cleared.'
        };

      case 'always':
        const mode = subargs[0]?.toLowerCase();
        if (mode === 'on' || mode === 'true') {
          this.permissionCache.setAlwaysAsk(true);
          return {
            type: 'success',
            message: 'Always-ask mode enabled. All tool calls will require explicit permission.'
          };
        } else if (mode === 'off' || mode === 'false') {
          this.permissionCache.setAlwaysAsk(false);
          return {
            type: 'success',
            message: 'Always-ask mode disabled. Cached permissions will be used when available.'
          };
        } else {
          const currentMode = this.permissionCache.getStats().alwaysAsk;
          return {
            type: 'info',
            message: `Always-ask mode is currently ${currentMode ? 'ON' : 'OFF'}. Use "/permissions always on" or "/permissions always off" to change.`
          };
        }

      default:
        return {
          type: 'error',
          message: `Unknown permissions subcommand: ${subcommand}`
        };
    }
  }

  async switchProvider(args) {
    const manager = getLLMProviderManager();
    if (!manager) {
      return { type: 'error', message: 'LLM provider manager not initialized' };
    }

    if (!args) {
      const currentProvider = manager.getProviderType();
      const modelName = manager.getModelName();
      return {
        type: 'info',
        message: `Current LLM provider: ${currentProvider} (${modelName})`
      };
    }

    const provider = args.toLowerCase().trim();
    if (provider !== 'anthropic' && provider !== 'ollama' && provider !== 'inline-llm') {
      return {
        type: 'error',
        message: 'Invalid provider. Use "anthropic", "ollama", or "inline-llm"'
      };
    }

    try {
      // Get config from configService if available
      let config = {};
      if (this.configService) {
        const llmConfig = this.configService.getLLMConfig();
        config = { ...llmConfig, provider };
      }

      await manager.switchProvider(provider, config);
      const modelName = manager.getModelName();

      // Persist the provider change to disk
      if (this.configService) {
        this.configService.setLLMProvider(provider, config);
        const savedPath = this.configService.saveLLMConfig();
      }

      if (provider === 'ollama') {
        return {
          type: 'success',
          message: `Switched to Ollama provider (${modelName})`,
          additionalMessage: 'Note: Make sure Ollama is running (ollama serve). Provider preference saved.'
        };
      } else if (provider === 'inline-llm') {
        return {
          type: 'success',
          message: `Switched to Inline Local LLM provider (${modelName})`,
          additionalMessage: 'Note: Models run directly in Ronin. Use /models-available to see downloadable models. Provider preference saved.'
        };
      } else {
        return {
          type: 'success',
          message: `Switched to Anthropic Claude provider. Provider preference saved.`
        };
      }
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to switch provider: ${error.message}`
      };
    }
  }

  async listModels() {
    const manager = getLLMProviderManager();
    if (!manager) {
      return { type: 'error', message: 'LLM provider manager not initialized' };
    }

    if (manager.getProviderType() !== 'ollama' && manager.getProviderType() !== 'inline-llm') {
      return {
        type: 'info',
        message: 'Model listing is only available for Ollama and Inline LLM providers'
      };
    }

    try {
      const models = await manager.listAvailableModels();
      if (models.length === 0) {
        return {
          type: 'info',
          message: 'No models found. Use "/pull [model]" to download a model'
        };
      }

      const providerName = manager.getProviderType() === 'ollama' ? 'Ollama' : 'Local';
      const modelList = models.map(m => {
        if (manager.getProviderType() === 'inline-llm') {
          return `  - ${m.name} (${m.size})`;
        } else {
          return `  - ${m.name} (${m.size})`;
        }
      }).join('\n');
      return {
        type: 'list',
        message: `Available ${providerName} models:\n${modelList}`
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to list models: ${error.message}`
      };
    }
  }

  async pullModel(args) {
    if (!args) {
      return {
        type: 'error',
        message: 'Usage: /pull [model-name]\nExample: /pull llama3.2:3b'
      };
    }

    const manager = getLLMProviderManager();
    if (!manager) {
      return { type: 'error', message: 'LLM provider manager not initialized' };
    }

    if (manager.getProviderType() !== 'ollama') {
      return {
        type: 'info',
        message: 'Model pulling is only available for Ollama provider. Use /download for Inline LLM models.'
      };
    }

    try {
      return {
        type: 'info',
        message: `Pulling model ${args}... This may take a while.`
      };

      await manager.pullModel(args);

      return {
        type: 'success',
        message: `Successfully pulled model: ${args}`
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to pull model: ${error.message}`
      };
    }
  }

  async manageMCP(args) {
    if (!this.mcpManager) {
      return {
        type: 'error',
        message: 'MCP Manager is not initialized.'
      };
    }

    if (!args) {
      return {
        type: 'info',
        message: `MCP server management commands:
  /mcp list            - List connected MCP servers and their tools
  /mcp add             - Add a new MCP server interactively
  /mcp remove [name]   - Remove an MCP server
  /mcp reload          - Reload MCP configuration from mcp.json`
      };
    }

    const [subcommand, ...subargs] = args.split(' ');

    switch (subcommand.toLowerCase()) {
      case 'list':
        const servers = this.mcpManager.getServers();
        const tools = this.mcpManager.getAvailableTools();

        if (servers.length === 0) {
          return {
            type: 'info',
            message: 'No MCP servers connected.'
          };
        }

        let message = `Connected MCP servers (${servers.length}):\n`;
        for (const serverName of servers) {
          const serverTools = tools.filter(t => t.server === serverName);
          message += `\n  ${serverName} (${serverTools.length} tools)`;
          if (serverTools.length > 0) {
            message += ':\n';
            for (const tool of serverTools) {
              message += `    - ${tool.name}: ${tool.description || 'No description'}\n`;
            }
          }
        }
        return {
          type: 'info',
          message
        };

      case 'add':
        try {
          const newServer = await this.interactiveMCPServerAdd();
          if (newServer) {
            // Update configuration
            const config = this.configService.getMCPConfig();
            if (!config.servers) {
              config.servers = {};
            }
            config.servers[newServer.name] = newServer.config;
            this.configService.saveMCPConfig(config);

            // Connect to the new server
            await this.mcpManager.connectServer(newServer.name, newServer.config);

            return {
              type: 'success',
              message: `MCP server '${newServer.name}' has been added and connected.`
            };
          } else {
            return {
              type: 'info',
              message: 'MCP server addition cancelled.'
            };
          }
        } catch (error) {
          return {
            type: 'error',
            message: `Failed to add MCP server: ${error.message}`
          };
        }

      case 'remove':
        const serverName = subargs[0];
        if (!serverName) {
          return {
            type: 'error',
            message: 'Usage: /mcp remove [server-name]'
          };
        }

        try {
          await this.mcpManager.disconnectServer(serverName);

          // Update configuration file
          if (this.configService) {
            const config = this.configService.getMCPConfig();
            if (config && config.servers && config.servers[serverName]) {
              delete config.servers[serverName];
              this.configService.saveMCPConfig(config);
            }
          }

          return {
            type: 'success',
            message: `MCP server '${serverName}' has been removed.`
          };
        } catch (error) {
          return {
            type: 'error',
            message: `Failed to remove server: ${error.message}`
          };
        }

      case 'reload':
        try {
          // Shutdown existing connections
          await this.mcpManager.shutdown();

          // Reload configuration and reinitialize
          if (this.configService) {
            this.configService.reloadMCPConfig();
          }
          await this.mcpManager.initialize();

          const servers = this.mcpManager.getServers();
          return {
            type: 'success',
            message: `MCP configuration reloaded. ${servers.length} server(s) connected.`
          };
        } catch (error) {
          return {
            type: 'error',
            message: `Failed to reload MCP configuration: ${error.message}`
          };
        }

      default:
        return {
          type: 'error',
          message: `Unknown MCP subcommand: ${subcommand}`
        };
    }
  }

  async interactiveMCPServerAdd() {
    if (!this.conversationService || !this.conversationService.cliInterface) {
      throw new Error('CLI interface not available for interactive configuration');
    }

    const cli = this.conversationService.cliInterface;

    console.log(chalk.cyan('\n=== Interactive MCP Server Configuration ==='));

    // Get server name
    const name = await cli.getUserInput('Server name: ');
    if (!name.trim()) {
      console.log(chalk.red('Server name is required.'));
      return null;
    }

    // Check if server already exists
    const existing = this.mcpManager.getServers();
    if (existing.includes(name)) {
      console.log(chalk.red(`Server '${name}' already exists.`));
      return null;
    }

    // Get transport type
    console.log('\nTransport options:');
    console.log('  1. stdio (Standard Input/Output)');
    console.log('  2. sse (Server-Sent Events)');
    console.log('  3. websocket (WebSocket)');

    const transportChoice = await cli.getUserInput('Select transport (1-3): ');

    let transport, config = {};

    switch (transportChoice.trim()) {
      case '1':
        transport = 'stdio';
        config = await this.configureStdioTransport(cli);
        break;
      case '2':
        transport = 'sse';
        config = await this.configureSSETransport(cli);
        break;
      case '3':
        transport = 'websocket';
        config = await this.configureWebSocketTransport(cli);
        break;
      default:
        console.log(chalk.red('Invalid transport selection.'));
        return null;
    }

    if (!config) {
      return null;
    }

    config.transport = transport;

    // Confirm configuration
    console.log(chalk.cyan('\n=== Configuration Summary ==='));
    console.log(`Name: ${name}`);
    console.log(`Transport: ${transport}`);
    console.log(`Configuration: ${JSON.stringify(config, null, 2)}`);

    const confirmed = await cli.askConfirmation('Add this MCP server?');
    if (!confirmed) {
      return null;
    }

    return { name, config };
  }

  async configureStdioTransport(cli) {
    const command = await cli.getUserInput('Command to run: ');
    if (!command.trim()) {
      console.log(chalk.red('Command is required for stdio transport.'));
      return null;
    }

    const argsInput = await cli.getUserInput('Arguments (space-separated, optional): ');
    const args = argsInput.trim() ? argsInput.trim().split(' ') : [];

    const cwdInput = await cli.getUserInput('Working directory (optional): ');
    const cwd = cwdInput.trim() || undefined;

    const envInput = await cli.getUserInput('Environment variables (JSON format, optional): ');
    let env = undefined;
    if (envInput.trim()) {
      try {
        env = JSON.parse(envInput);
      } catch (error) {
        console.log(chalk.red('Invalid JSON for environment variables.'));
        return null;
      }
    }

    const config = { command, args };
    if (cwd) config.cwd = cwd;
    if (env) config.env = env;

    return config;
  }

  async configureSSETransport(cli) {
    const url = await cli.getUserInput('Server URL: ');
    if (!url.trim()) {
      console.log(chalk.red('URL is required for SSE transport.'));
      return null;
    }

    const headersInput = await cli.getUserInput('Headers (JSON format, optional): ');
    let headers = undefined;
    if (headersInput.trim()) {
      try {
        headers = JSON.parse(headersInput);
      } catch (error) {
        console.log(chalk.red('Invalid JSON for headers.'));
        return null;
      }
    }

    const config = { url };
    if (headers) config.headers = headers;

    return config;
  }

  async configureWebSocketTransport(cli) {
    const url = await cli.getUserInput('WebSocket URL: ');
    if (!url.trim()) {
      console.log(chalk.red('URL is required for WebSocket transport.'));
      return null;
    }

    return { url };
  }
}