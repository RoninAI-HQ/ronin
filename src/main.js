import { getClaudeResponse } from './api.js';
import {
  initializeCLI,
  getUserInput,
  displayAssistantResponse,
  displayMessage,
  clearScreen,
  closeCLI,
  streamAssistantResponse,
} from './cli.js';
import chalk from 'chalk';
import { Spinner } from 'cli-spinner';

// Stores the conversation history. Each element is an object: { role: 'user'|'assistant', content: string }
const conversationHistory = [];
let spinnerInstance; // Declare here for accessibility in final catch

async function chat() {
  initializeCLI();
  displayMessage("Welcome to Claude CLI! Type '/exit' or '/quit' to end the chat, or '/clear' to clear screen, or '/clear-chat' to clear conversation history.");

  let userInput;
  spinnerInstance = new Spinner('%s');
  spinnerInstance.setSpinnerString(18);

  while (true) {
    userInput = await getUserInput('\n> ');

    if (userInput.toLowerCase() === '/exit' || userInput.toLowerCase() === '/quit') {
      displayMessage('Exiting Claude CLI. Goodbye!');
      break;
    }

    if (userInput.toLowerCase() === '/clear') {
      clearScreen();
      displayMessage('Screen cleared.');
      continue;
    }

    if (userInput.toLowerCase() === '/clear-chat') {
      conversationHistory.length = 0;
      displayMessage('Conversation history cleared.');
      continue;
    }

    conversationHistory.push({ role: 'user', content: userInput });

    spinnerInstance.start();

    try {
      const assistantResponseStream = getClaudeResponse(userInput, conversationHistory.slice(0, -1));
      
      let fullAssistantResponse = '';
      if (assistantResponseStream) {
        let isFirstChunk = true;
        for await (const chunk of assistantResponseStream) {
          if (isFirstChunk) {
            spinnerInstance.stop(true);
            process.stdout.write(chalk.hex('#888')('\nAssistant: '));
            isFirstChunk = false;
          }
          if (chunk) {
            streamAssistantResponse(chunk);
            fullAssistantResponse += chunk;
          }
        }
        
        if (isFirstChunk) {
          spinnerInstance.stop(true);
          displayMessage(
            'Claude responded, but the message was empty. Please try again.'
          );
        } else {
          streamAssistantResponse('\n');
          if (fullAssistantResponse) {
            conversationHistory.push({ role: 'assistant', content: fullAssistantResponse });
          }
        }
      } else {
        spinnerInstance.stop(true);
        displayMessage(
          'Sorry, I encountered an error or could not get a response. Please try again.'
        );
      }
    } catch (error) {
      spinnerInstance.stop(true);
      console.error('API call failed:', error);
      displayMessage('An error occurred while talking to Claude. Check console for details.');
    }
  }

  closeCLI();
}

// Start the chat application
chat().catch((error) => {
  if (spinnerInstance && typeof spinnerInstance.stop === 'function') {
    spinnerInstance.stop(true);
  }
  console.error('An unexpected error occurred in chat():', error);
  closeCLI();
  process.exit(1);
}); 