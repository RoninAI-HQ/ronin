import { PermissionCache } from './PermissionCache.js';
import { getLLMProviderManager } from '../api.js';
import { inlineLLMCommands } from './CommandServiceExtensions.js';
import chalk from 'chalk';
import {
  validateUrl,
  validateJson,
  validateServerName,
  validateCommand,
  validateEnvVars,
  parseShellArgs
} from '../utils/validators.js';

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
  /mcp                 - Show MCP commands help
  /mcp list            - List all servers with status
  /mcp info [name]     - Show detailed server information
  /mcp add             - Add new server (interactive)
  /mcp edit [name]     - Edit server configuration
  /mcp remove [name]   - Remove server (with confirmation)
  /mcp test [name]     - Test server connection
  /mcp enable [name]   - Enable disabled server
  /mcp disable [name]  - Temporarily disable server
  /mcp reload          - Reload configuration from disk

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
  /mcp info [name]     - Show detailed information about a server
  /mcp add             - Add a new MCP server interactively
  /mcp edit [name]     - Edit an existing server configuration
  /mcp remove [name]   - Remove an MCP server (with confirmation)
  /mcp enable [name]   - Enable a disabled server
  /mcp disable [name]  - Disable a server temporarily
  /mcp test [name]     - Test connection to a configured server
  /mcp reload          - Reload MCP configuration from mcp.json

For more information, see: MCP_GUIDE.md`
      };
    }

    const [subcommand, ...subargs] = args.split(' ');

    switch (subcommand.toLowerCase()) {
      case 'list':
        return await this.mcpList();

      case 'info':
        return await this.mcpInfo(subargs[0]);

      case 'add':
        return await this.mcpAdd();

      case 'edit':
        return await this.mcpEdit(subargs[0]);

      case 'remove':
        return await this.mcpRemove(subargs[0]);

      case 'enable':
        return await this.mcpEnable(subargs[0]);

      case 'disable':
        return await this.mcpDisable(subargs[0]);

      case 'test':
        return await this.mcpTest(subargs[0]);

      case 'reload':
        return await this.mcpReload();

      default:
        return {
          type: 'error',
          message: `Unknown MCP subcommand: ${subcommand}\nUse "/mcp" to see available commands.`
        };
    }
  }

  async mcpList() {
    const allServers = this.mcpManager.getAllServerInfo();
    const tools = this.mcpManager.getAvailableTools();
    const totalTools = tools.length;

    if (allServers.length === 0) {
      return {
        type: 'info',
        message: 'No MCP servers configured.\n\nUse "/mcp add" to add a server.'
      };
    }

    const connected = allServers.filter(s => s.connected);
    const failed = allServers.filter(s => !s.connected && !s.disabled && s.error);
    const disabled = allServers.filter(s => s.disabled);

    let message = `MCP Servers (${allServers.length} total, ${totalTools} tools):\n`;

    // Connected servers
    if (connected.length > 0) {
      message += `\n${chalk.green('✓ Connected')} (${connected.length}):\n`;
      for (const server of connected) {
        message += `  ${server.name} (${server.toolCount} tools)\n`;
        if (server.toolCount > 0 && server.toolCount <= 10) {
          for (const tool of server.tools) {
            message += chalk.gray(`    - ${tool.name}: ${tool.description || 'No description'}\n`);
          }
        } else if (server.toolCount > 10) {
          for (const tool of server.tools.slice(0, 5)) {
            message += chalk.gray(`    - ${tool.name}: ${tool.description || 'No description'}\n`);
          }
          message += chalk.gray(`    ... and ${server.toolCount - 5} more tools\n`);
        }
      }
    }

    // Failed servers
    if (failed.length > 0) {
      message += `\n${chalk.red('✗ Failed')} (${failed.length}):\n`;
      for (const server of failed) {
        message += `  ${server.name} - ${chalk.red(server.error)}\n`;
      }
    }

    // Disabled servers
    if (disabled.length > 0) {
      message += `\n${chalk.yellow('⊘ Disabled')} (${disabled.length}):\n`;
      for (const server of disabled) {
        message += `  ${server.name}\n`;
      }
    }

    return { type: 'info', message };
  }

  async mcpInfo(name) {
    if (!name) {
      return {
        type: 'error',
        message: 'Usage: /mcp info [server-name]'
      };
    }

    const info = this.mcpManager.getServerInfo(name);
    if (!info) {
      return {
        type: 'error',
        message: `Server '${name}' not found.`
      };
    }

    let message = `${chalk.cyan('=== Server Information ===')}\n\n`;
    message += `Name: ${info.name}\n`;
    message += `Status: ${info.connected ? chalk.green('✓ Connected') : info.disabled ? chalk.yellow('⊘ Disabled') : chalk.red('✗ Disconnected')}\n`;
    message += `Transport: ${info.transport}\n`;
    message += `Tools: ${info.toolCount}\n`;

    if (info.connectedAt) {
      message += `Connected: ${info.connectedAt.toLocaleString()}\n`;
    }

    if (info.error) {
      message += `${chalk.red('Error:')} ${info.error}\n`;
      if (info.failedAt) {
        message += `Failed: ${info.failedAt.toLocaleString()}\n`;
      }
    }

    if (info.config) {
      message += `\n${chalk.cyan('Configuration:')}\n`;
      message += JSON.stringify(info.config, null, 2);
    }

    if (info.tools.length > 0) {
      message += `\n\n${chalk.cyan('Available Tools:')}\n`;
      for (const tool of info.tools) {
        message += `  - ${tool.name}: ${tool.description || 'No description'}\n`;
      }
    }

    return { type: 'info', message };
  }

  async mcpAdd() {
    try {
      const newServer = await this.interactiveMCPServerAdd();
      if (!newServer) {
        return {
          type: 'info',
          message: 'MCP server addition cancelled.'
        };
      }

      if (newServer.error) {
        return {
          type: 'error',
          message: newServer.error
        };
      }

      // Update configuration
      const config = this.configService.getMCPConfig();
      if (!config.servers) {
        config.servers = {};
      }
      config.servers[newServer.name] = newServer.config;
      this.configService.saveMCPConfig(config);

      // Connect to the new server
      try {
        await this.mcpManager.connectServer(newServer.name, newServer.config);
        const info = this.mcpManager.getServerInfo(newServer.name);

        return {
          type: 'success',
          message: `${chalk.green('✓')} MCP server '${newServer.name}' added successfully.`,
          additionalMessage: `Connected with ${info.toolCount} tools available.`
        };
      } catch (error) {
        return {
          type: 'error',
          message: `Server added to configuration but failed to connect: ${error.message}`,
          additionalMessage: 'Use "/mcp test ${newServer.name}" to diagnose the issue.'
        };
      }
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to add MCP server: ${error.message}`
      };
    }
  }

  async mcpEdit(name) {
    if (!name) {
      return {
        type: 'error',
        message: 'Usage: /mcp edit [server-name]'
      };
    }

    const info = this.mcpManager.getServerInfo(name);
    if (!info) {
      return {
        type: 'error',
        message: `Server '${name}' not found.`
      };
    }

    try {
      const updatedServer = await this.interactiveMCPServerAdd(info.config, name);
      if (!updatedServer) {
        return {
          type: 'info',
          message: 'Edit cancelled.'
        };
      }

      if (updatedServer.error) {
        return {
          type: 'error',
          message: updatedServer.error
        };
      }

      // Update configuration
      const config = this.configService.getMCPConfig();
      config.servers[name] = updatedServer.config;
      this.configService.saveMCPConfig(config);

      // Reconnect if it was connected
      if (info.connected) {
        try {
          await this.mcpManager.disconnectServer(name);
          await this.mcpManager.connectServer(name, updatedServer.config);
        } catch (error) {
          return {
            type: 'error',
            message: `Configuration updated but failed to reconnect: ${error.message}`
          };
        }
      }

      return {
        type: 'success',
        message: `Server '${name}' configuration updated successfully.`
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to edit server: ${error.message}`
      };
    }
  }

  async mcpRemove(serverName) {
    if (!serverName) {
      return {
        type: 'error',
        message: 'Usage: /mcp remove [server-name]'
      };
    }

    const info = this.mcpManager.getServerInfo(serverName);
    if (!info) {
      return {
        type: 'error',
        message: `Server '${serverName}' not found.`
      };
    }

    // Ask for confirmation
    if (this.conversationService?.cliInterface) {
      const toolCount = info.toolCount;
      const confirmMsg = `Remove server '${serverName}' and its ${toolCount} tool(s)?`;
      const confirmed = await this.conversationService.cliInterface.askConfirmation(confirmMsg);

      if (!confirmed) {
        return {
          type: 'info',
          message: 'Removal cancelled.'
        };
      }
    }

    try {
      const result = await this.mcpManager.disconnectServer(serverName);

      // Update configuration file
      if (this.configService) {
        const config = this.configService.getMCPConfig();
        if (config?.servers?.[serverName]) {
          delete config.servers[serverName];
          this.configService.saveMCPConfig(config);
        }
      }

      return {
        type: 'success',
        message: `${chalk.green('✓')} Server '${serverName}' removed successfully.`,
        additionalMessage: `Removed ${result.toolCount} tool(s).`
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to remove server: ${error.message}`
      };
    }
  }

  async mcpEnable(name) {
    if (!name) {
      return {
        type: 'error',
        message: 'Usage: /mcp enable [server-name]'
      };
    }

    const info = this.mcpManager.getServerInfo(name);
    if (!info) {
      return {
        type: 'error',
        message: `Server '${name}' not found.`
      };
    }

    if (info.connected) {
      return {
        type: 'info',
        message: `Server '${name}' is already connected.`
      };
    }

    if (!info.disabled) {
      return {
        type: 'info',
        message: `Server '${name}' is not disabled.`
      };
    }

    try {
      this.mcpManager.enableServer(name);
      await this.mcpManager.connectServer(name, info.config);

      const updatedInfo = this.mcpManager.getServerInfo(name);
      return {
        type: 'success',
        message: `${chalk.green('✓')} Server '${name}' enabled and connected.`,
        additionalMessage: `${updatedInfo.toolCount} tool(s) now available.`
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to enable server: ${error.message}`
      };
    }
  }

  async mcpDisable(name) {
    if (!name) {
      return {
        type: 'error',
        message: 'Usage: /mcp disable [server-name]'
      };
    }

    const info = this.mcpManager.getServerInfo(name);
    if (!info) {
      return {
        type: 'error',
        message: `Server '${name}' not found.`
      };
    }

    if (info.disabled) {
      return {
        type: 'info',
        message: `Server '${name}' is already disabled.`
      };
    }

    try {
      await this.mcpManager.disableServer(name);
      return {
        type: 'success',
        message: `${chalk.green('✓')} Server '${name}' disabled.`,
        additionalMessage: 'Use "/mcp enable ${name}" to re-enable.'
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to disable server: ${error.message}`
      };
    }
  }

  async mcpTest(name) {
    if (!name) {
      return {
        type: 'error',
        message: 'Usage: /mcp test [server-name]'
      };
    }

    const info = this.mcpManager.getServerInfo(name);
    if (!info) {
      return {
        type: 'error',
        message: `Server '${name}' not found in configuration.`
      };
    }

    try {
      console.log(chalk.cyan(`Testing connection to '${name}'...`));
      const result = await this.mcpManager.testServerConnection(name, info.config);

      if (result.success) {
        let message = `${chalk.green('✓')} Connection test successful!\n`;
        message += `Found ${result.toolCount} tool(s):\n`;
        for (const tool of result.tools.slice(0, 10)) {
          message += `  - ${tool.name}: ${tool.description || 'No description'}\n`;
        }
        if (result.tools.length > 10) {
          message += `  ... and ${result.tools.length - 10} more\n`;
        }
        return {
          type: 'success',
          message
        };
      } else {
        return {
          type: 'error',
          message: `${chalk.red('✗')} Connection test failed: ${result.error}`
        };
      }
    } catch (error) {
      return {
        type: 'error',
        message: `Test failed: ${error.message}`
      };
    }
  }

  async mcpReload() {
    try {
      // Get current state for comparison
      const oldServers = this.mcpManager.getServers();
      const oldConfig = this.configService.getMCPConfig();

      // Reload configuration
      this.configService.reloadMCPConfig();
      const newConfig = this.configService.getMCPConfig();

      // Find differences
      const oldServerNames = new Set(oldServers);
      const newServerNames = new Set(Object.keys(newConfig?.servers || {}));

      const added = [...newServerNames].filter(n => !oldServerNames.has(n));
      const removed = [...oldServerNames].filter(n => !newServerNames.has(n));
      const existing = [...newServerNames].filter(n => oldServerNames.has(n));

      // Show what will change
      let changeMsg = 'Reloading MCP configuration...\n\n';
      if (added.length > 0) {
        changeMsg += chalk.green(`  Adding: ${added.join(', ')}\n`);
      }
      if (removed.length > 0) {
        changeMsg += chalk.red(`  Removing: ${removed.join(', ')}\n`);
      }
      if (existing.length > 0) {
        changeMsg += chalk.yellow(`  Existing: ${existing.length} server(s)\n`);
      }

      console.log(changeMsg);

      // Reinitialize
      await this.mcpManager.shutdown();
      const result = await this.mcpManager.initialize();

      let message = `${chalk.green('✓')} MCP configuration reloaded.\n\n`;
      message += `Connected: ${result.success} server(s)\n`;

      if (result.failed > 0) {
        message += chalk.red(`Failed: ${result.failed} server(s)\n`);
        if (result.errors.length > 0) {
          message += '\nErrors:\n';
          for (const err of result.errors) {
            message += `  - ${err.server}: ${err.error}\n`;
          }
        }
      }

      if (added.length > 0) {
        message += chalk.green(`\nAdded: ${added.join(', ')}\n`);
      }
      if (removed.length > 0) {
        message += chalk.red(`\nRemoved: ${removed.join(', ')}\n`);
      }

      return {
        type: result.failed > 0 ? 'warning' : 'success',
        message
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to reload MCP configuration: ${error.message}`
      };
    }
  }

  async interactiveMCPServerAdd(existingConfig = null, existingName = null) {
    if (!this.conversationService || !this.conversationService.cliInterface) {
      throw new Error('CLI interface not available for interactive configuration');
    }

    const cli = this.conversationService.cliInterface;
    const isEdit = !!existingName;

    console.log(chalk.cyan(`\n=== ${isEdit ? 'Edit' : 'Add'} MCP Server Configuration ===`));

    // Get server name (skip if editing)
    let name = existingName;
    if (!isEdit) {
      while (true) {
        name = await cli.getUserInput('Server name: ');
        const nameValidation = validateServerName(name);

        if (!nameValidation.valid) {
          console.log(chalk.red(nameValidation.error));
          continue;
        }

        // Check if server already exists
        const existing = this.mcpManager.getServers();
        if (existing.includes(name)) {
          console.log(chalk.red(`Server '${name}' already exists. Use "/mcp edit ${name}" to edit it.`));
          continue;
        }

        break;
      }
    } else {
      console.log(`Editing server: ${chalk.cyan(name)}`);
    }

    // Get transport type
    console.log('\nTransport options:');
    console.log('  1. stdio (Standard Input/Output) - for local processes');
    console.log('  2. sse (Server-Sent Events) - for HTTP-based servers');
    console.log('  3. websocket (WebSocket) - for real-time connections');

    if (existingConfig) {
      const currentTransport = existingConfig.transport || 'stdio';
      console.log(chalk.gray(`\nCurrent transport: ${currentTransport}`));
    }

    let transport, config = {};
    let transportChoice;

    while (true) {
      transportChoice = await cli.getUserInput('Select transport (1-3): ');

      switch (transportChoice.trim()) {
        case '1':
          transport = 'stdio';
          config = await this.configureStdioTransport(cli, existingConfig);
          break;
        case '2':
          transport = 'sse';
          config = await this.configureSSETransport(cli, existingConfig);
          break;
        case '3':
          transport = 'websocket';
          config = await this.configureWebSocketTransport(cli, existingConfig);
          break;
        default:
          console.log(chalk.red('Invalid transport selection. Please enter 1, 2, or 3.'));
          continue;
      }

      if (config && config.error) {
        console.log(chalk.red(config.error));
        return { error: config.error };
      }

      if (!config) {
        return null; // User cancelled
      }

      break;
    }

    config.transport = transport;

    // Confirm configuration
    console.log(chalk.cyan('\n=== Configuration Summary ==='));
    console.log(`Name: ${chalk.green(name)}`);
    console.log(`Transport: ${chalk.green(transport)}`);
    console.log(`\nConfiguration:`);
    console.log(JSON.stringify(config, null, 2));

    const confirmed = await cli.askConfirmation(`${isEdit ? 'Save' : 'Add'} this MCP server?`);
    if (!confirmed) {
      return null;
    }

    return { name, config };
  }

  async configureStdioTransport(cli, existingConfig = null) {
    console.log(chalk.gray('\nConfiguring stdio transport...'));
    console.log(chalk.gray('Example: command="docker", args=["run", "-i", "my-image"]'));

    // Command
    let command;
    while (true) {
      const defaultCmd = existingConfig?.command || '';
      const prompt = defaultCmd ? `Command to run [${defaultCmd}]: ` : 'Command to run: ';
      command = await cli.getUserInput(prompt);

      if (!command && defaultCmd) {
        command = defaultCmd;
      }

      const cmdValidation = validateCommand(command);
      if (!cmdValidation.valid) {
        console.log(chalk.red(cmdValidation.error));
        continue;
      }

      break;
    }

    // Arguments
    console.log(chalk.gray('\nArguments can include spaces if quoted, e.g.: arg1 "arg with spaces" arg3'));
    const defaultArgs = existingConfig?.args ? existingConfig.args.join(' ') : '';
    const argsPrompt = defaultArgs ? `Arguments [${defaultArgs}]: ` : 'Arguments (optional): ';
    const argsInput = await cli.getUserInput(argsPrompt);

    const argsToUse = argsInput || defaultArgs;
    const args = argsToUse ? parseShellArgs(argsToUse) : [];

    // Working directory
    const defaultCwd = existingConfig?.cwd || '';
    const cwdPrompt = defaultCwd ? `Working directory [${defaultCwd}]: ` : 'Working directory (optional): ';
    let cwdInput = await cli.getUserInput(cwdPrompt);
    if (!cwdInput && defaultCwd) {
      cwdInput = defaultCwd;
    }
    const cwd = cwdInput.trim() || undefined;

    // Environment variables
    console.log(chalk.gray('\nEnvironment variables in JSON format, e.g.: {"API_KEY": "${MY_API_KEY}"}'));
    const defaultEnv = existingConfig?.env ? JSON.stringify(existingConfig.env) : '';
    const envPrompt = defaultEnv ? `Environment variables [${defaultEnv}]: ` : 'Environment variables (optional): ';
    const envInput = await cli.getUserInput(envPrompt);

    const envToUse = envInput || defaultEnv;
    let env = undefined;

    if (envToUse) {
      const envValidation = validateJson(envToUse);
      if (!envValidation.valid) {
        console.log(chalk.red(envValidation.error));
        return { error: envValidation.error };
      }

      const envVarValidation = validateEnvVars(envValidation.parsed);
      if (!envVarValidation.valid) {
        console.log(chalk.red(envVarValidation.error));
        return { error: envVarValidation.error };
      }

      env = envValidation.parsed;
    }

    const config = { command, args };
    if (cwd) config.cwd = cwd;
    if (env) config.env = env;

    return config;
  }

  async configureSSETransport(cli, existingConfig = null) {
    console.log(chalk.gray('\nConfiguring SSE (Server-Sent Events) transport...'));
    console.log(chalk.gray('Example: https://api.example.com/mcp'));

    // URL
    let url;
    while (true) {
      const defaultUrl = existingConfig?.url || '';
      const prompt = defaultUrl ? `Server URL [${defaultUrl}]: ` : 'Server URL: ';
      url = await cli.getUserInput(prompt);

      if (!url && defaultUrl) {
        url = defaultUrl;
      }

      const urlValidation = validateUrl(url, {
        allowedProtocols: ['http', 'https']
      });

      if (!urlValidation.valid) {
        console.log(chalk.red(urlValidation.error));
        continue;
      }

      if (urlValidation.warning) {
        console.log(chalk.yellow(urlValidation.warning));
      }

      url = urlValidation.normalized;
      break;
    }

    // Headers
    console.log(chalk.gray('\nHeaders in JSON format, e.g.: {"Authorization": "Bearer ${TOKEN}"}'));
    const defaultHeaders = existingConfig?.headers ? JSON.stringify(existingConfig.headers) : '';
    const headersPrompt = defaultHeaders ? `Headers [${defaultHeaders}]: ` : 'Headers (optional): ';
    const headersInput = await cli.getUserInput(headersPrompt);

    const headersToUse = headersInput || defaultHeaders;
    let headers = undefined;

    if (headersToUse) {
      const headersValidation = validateJson(headersToUse);
      if (!headersValidation.valid) {
        console.log(chalk.red(headersValidation.error));
        return { error: headersValidation.error };
      }
      headers = headersValidation.parsed;
    }

    const config = { url };
    if (headers) config.headers = headers;

    return config;
  }

  async configureWebSocketTransport(cli, existingConfig = null) {
    console.log(chalk.gray('\nConfiguring WebSocket transport...'));
    console.log(chalk.gray('Example: ws://localhost:8080/mcp or wss://api.example.com/mcp'));

    // URL
    let url;
    while (true) {
      const defaultUrl = existingConfig?.url || '';
      const prompt = defaultUrl ? `WebSocket URL [${defaultUrl}]: ` : 'WebSocket URL: ';
      url = await cli.getUserInput(prompt);

      if (!url && defaultUrl) {
        url = defaultUrl;
      }

      const urlValidation = validateUrl(url, {
        allowedProtocols: ['ws', 'wss', 'http', 'https']
      });

      if (!urlValidation.valid) {
        console.log(chalk.red(urlValidation.error));
        continue;
      }

      // Auto-convert http(s) to ws(s)
      if (urlValidation.normalized.startsWith('http://')) {
        url = urlValidation.normalized.replace('http://', 'ws://');
        console.log(chalk.yellow(`Converted to WebSocket protocol: ${url}`));
      } else if (urlValidation.normalized.startsWith('https://')) {
        url = urlValidation.normalized.replace('https://', 'wss://');
        console.log(chalk.yellow(`Converted to secure WebSocket protocol: ${url}`));
      } else {
        url = urlValidation.normalized;
      }

      break;
    }

    return { url };
  }
}