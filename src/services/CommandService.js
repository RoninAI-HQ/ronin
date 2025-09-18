import { getLLMProviderManager } from '../api.js';

export class CommandService {
  constructor(fileService, conversationService) {
    this.fileService = fileService;
    this.conversationService = conversationService;
    this.configService = null;
    this.commands = {
      '/help': this.showHelp.bind(this),
      '/exit': this.exit.bind(this),
      '/quit': this.exit.bind(this),
      '/save': this.saveConversation.bind(this),
      '/export': this.exportConversation.bind(this),
      '/load': this.loadConversation.bind(this),
      '/new': this.newConversation.bind(this),
      '/clear': this.clearScreen.bind(this),
      '/provider': this.switchProvider.bind(this),
      '/models': this.listModels.bind(this),
      '/pull': this.pullModel.bind(this)
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

LLM Provider commands (current: ${currentProvider}):
  /provider      - Show current LLM provider.
  /provider [name] - Switch to specified provider (anthropic or ollama).
  /models        - List available models (Ollama only).
  /pull [model]  - Pull a new model (Ollama only).`
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
    if (provider !== 'anthropic' && provider !== 'ollama') {
      return {
        type: 'error',
        message: 'Invalid provider. Use "anthropic" or "ollama"'
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

      if (provider === 'ollama') {
        return {
          type: 'success',
          message: `Switched to Ollama provider (${modelName})`,
          additionalMessage: 'Note: Make sure Ollama is running (ollama serve)'
        };
      } else {
        return {
          type: 'success',
          message: `Switched to Anthropic Claude provider`
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

    if (manager.getProviderType() !== 'ollama') {
      return {
        type: 'info',
        message: 'Model listing is only available for Ollama provider'
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

      const modelList = models.map(m => `  - ${m.name} (${m.size})`).join('\n');
      return {
        type: 'list',
        message: `Available Ollama models:\n${modelList}`
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
        message: 'Model pulling is only available for Ollama provider'
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
}