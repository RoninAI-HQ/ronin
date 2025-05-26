import { getClaudeResponse } from '../api.js';

export class ConversationService {
  constructor() {
    this.history = [];
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
      const responseStream = getClaudeResponse(userMessage, this.history.slice(0, -1));
      
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