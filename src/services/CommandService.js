export class CommandService {
  constructor(fileService, conversationService) {
    this.fileService = fileService;
    this.conversationService = conversationService;
    this.commands = {
      '/help': this.showHelp.bind(this),
      '/exit': this.exit.bind(this),
      '/quit': this.exit.bind(this),
      '/save': this.saveConversation.bind(this),
      '/export': this.exportConversation.bind(this),
      '/load': this.loadConversation.bind(this),
      '/new': this.newConversation.bind(this),
      '/clear': this.clearScreen.bind(this)
    };
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
  /clear         - Clear the terminal screen.`
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
}