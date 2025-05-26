import fs from 'fs';
import path from 'path';

export class FileService {
  constructor() {
    this.conversationDirectory = process.cwd();
  }

  generateFilename(format = 'json') {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const extension = format === 'markdown' ? 'md' : 'json';
    const prefix = format === 'markdown' ? 'conversation' : 'convo';
    
    return `${prefix}__${day}_${month}_${year}__${hours}_${minutes}_${seconds}.${extension}`;
  }

  async saveConversation(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      throw new Error('No conversation history to save');
    }

    const fileName = this.generateFilename();
    const filePath = path.join(this.conversationDirectory, fileName);

    try {
      await fs.promises.writeFile(filePath, JSON.stringify(conversationHistory, null, 2));
      return fileName;
    } catch (error) {
      throw new Error(`Failed to save conversation: ${error.message}`);
    }
  }

  async exportConversationAsMarkdown(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      throw new Error('No conversation history to export');
    }

    const fileName = this.generateFilename('markdown');
    const filePath = path.join(this.conversationDirectory, fileName);

    try {
      const markdownContent = this.convertToMarkdown(conversationHistory);
      await fs.promises.writeFile(filePath, markdownContent);
      return fileName;
    } catch (error) {
      throw new Error(`Failed to export conversation as Markdown: ${error.message}`);
    }
  }

  convertToMarkdown(conversationHistory) {
    const now = new Date();
    const dateString = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let markdown = `# Conversation Export\n\n`;
    markdown += `**Date:** ${dateString}\n\n`;
    markdown += `---\n\n`;

    conversationHistory.forEach((message, index) => {
      const role = message.role === 'user' ? '👤 **User**' : '🤖 **Assistant**';
      markdown += `## ${role}\n\n`;
      markdown += `${message.content}\n\n`;
      
      if (index < conversationHistory.length - 1) {
        markdown += `---\n\n`;
      }
    });

    return markdown;
  }

  async loadConversation(fileName) {
    const filePath = path.resolve(this.conversationDirectory, fileName);

    try {
      const fileContent = await fs.promises.readFile(filePath, 'utf-8');
      const conversationHistory = JSON.parse(fileContent);
      
      if (!Array.isArray(conversationHistory)) {
        throw new Error('Invalid conversation file format');
      }
      
      return conversationHistory;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${fileName}`);
      }
      throw new Error(`Failed to load conversation: ${error.message}`);
    }
  }

  async listConversations() {
    try {
      const files = await fs.promises.readdir(this.conversationDirectory);
      return files.filter(file => /^convo__.*\.json$/.test(file));
    } catch (error) {
      throw new Error(`Failed to list conversations: ${error.message}`);
    }
  }
}