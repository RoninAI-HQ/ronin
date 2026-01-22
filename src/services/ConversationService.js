import { getClaudeResponse } from '../api.js';

export class ConversationService {
  constructor() {
    this.history = [];
    this.mcpManager = null;
    this.cliInterface = null;
  }

  setMCPManager(mcpManager) {
    this.mcpManager = mcpManager;
  }

  setCLIInterface(cliInterface) {
    this.cliInterface = cliInterface;
  }

  addMessage(role, content) {
    this.history.push({ role, content });
  }

  getHistory() {
    return this.history;
  }

  clearHistory() {
    this.history = [];
  }

  setHistory(newHistory) {
    this.history = [...newHistory];
  }

  getLastMessage() {
    return this.history[this.history.length - 1];
  }

  hasHistory() {
    return this.history.length > 0;
  }

  async *streamResponse(userMessage) {
    this.addMessage('user', userMessage);

    try {
      // Get available tools from MCP Manager
      let tools = null;
      if (this.mcpManager && this.mcpManager.hasTools()) {
        tools = this.mcpManager.getAvailableTools();
      }

      const responseStream = getClaudeResponse(userMessage, this.history.slice(0, -1), tools, this.mcpManager, this.cliInterface);

      let fullResponse = '';
      for await (const chunk of responseStream) {
        if (chunk) {
          fullResponse += chunk;
          yield chunk;
        }
      }

      if (fullResponse) {
        this.addMessage('assistant', fullResponse);
      }

      return fullResponse;
    } catch (error) {
      throw new Error(`Failed to get response: ${error.message}`);
    }
  }
}