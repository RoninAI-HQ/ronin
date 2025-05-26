#!/usr/bin/env node

import { ConversationService } from './services/ConversationService.js';
import { FileService } from './services/FileService.js';
import { CommandService } from './services/CommandService.js';
import { ConfigService } from './services/ConfigService.js';
import { UIController } from './ui/UIController.js';
import { CLIInterface } from './ui/CLIInterface.js';

class RoninCLI {
  constructor() {
    this.configService = new ConfigService();
    this.conversationService = new ConversationService();
    this.fileService = new FileService();
    this.commandService = new CommandService(this.fileService, this.conversationService);
    this.ui = new UIController();
    this.cli = new CLIInterface();
  }

  async initialize() {
    try {
      this.configService.loadConfig();
    } catch (error) {
      this.ui.displayError(`Configuration error: ${error.message}`);
      process.exit(1);
    }
  }

  async handleOneShotQuery(query) {
    await this.initialize();
    
    try {
      this.ui.showSpinner();
      const responseStream = this.conversationService.streamResponse(query);
      
      let isFirstChunk = true;
      for await (const chunk of responseStream) {
        if (isFirstChunk) {
          this.ui.hideSpinner();
          this.ui.displayAssistantPrefix();
          isFirstChunk = false;
        }
        this.ui.streamAssistantResponse(chunk);
      }
      
      if (isFirstChunk) {
        this.ui.hideSpinner();
        this.ui.displayError('Claude responded, but the message was empty.');
        process.exit(1);
      } else {
        this.ui.displayNewLine();
        process.exit(0);
      }
    } catch (error) {
      this.ui.hideSpinner();
      this.ui.displayError(`API error: ${error.message}`);
      process.exit(1);
    }
  }

  async run() {
    // Check for command line arguments for one-shot mode
    const args = process.argv.slice(2);
    if (args.length > 0) {
      const query = args.join(' ');
      await this.handleOneShotQuery(query);
      return;
    }

    // Interactive mode
    await this.initialize();
    
    this.ui.displayWelcome();

    let userInput;
    
    while (true) {
      this.ui.displayNewLine();
      
      try {
        userInput = await this.cli.getUserInput('> ');
      } catch (error) {
        this.ui.displayError(`Input error: ${error.message}`);
        break;
      }

      // Skip empty input
      if (!userInput.trim()) {
        continue;
      }

      // Handle commands
      if (this.commandService.isCommand(userInput)) {
        const result = await this.commandService.executeCommand(userInput);
        this.ui.displayCommandResult(result);
        
        if (result.type === 'exit') {
          break;
        }
        continue;
      }

      // Handle conversation
      this.ui.displayNewLine();
      this.ui.showSpinner();

      try {
        const responseStream = this.conversationService.streamResponse(userInput);
        
        let isFirstChunk = true;
        for await (const chunk of responseStream) {
          if (isFirstChunk) {
            this.ui.hideSpinner();
            this.ui.displayAssistantPrefix();
            isFirstChunk = false;
          }
          this.ui.streamAssistantResponse(chunk);
        }
        
        if (isFirstChunk) {
          this.ui.hideSpinner();
          this.ui.displayMessage('Claude responded, but the message was empty. Please try again.');
        } else {
          this.ui.displayNewLine();
        }
      } catch (error) {
        this.ui.hideSpinner();
        this.ui.displayError(`API error: ${error.message}`);
      }
    }

    this.cli.close();
  }
}

// Start the application
const app = new RoninCLI();
app.run().catch((error) => {
  console.error('Application error:', error);
  process.exit(1);
});