import { getClaudeResponse } from './api.js';
import {
  initializeCLI,
  getUserInput,
  displayAssistantResponse,
  displayMessage,
  clearScreen,
  closeCLI,
} from './cli.js';
import chalk from 'chalk';
import ora from 'ora';

// Stores the conversation history. Each element is an object: { role: 'user'|'assistant', content: string }
const conversationHistory = [];

async function chat() {
  initializeCLI();
  displayMessage("Welcome to Claude CLI! Type '/exit' or '/quit' to end the chat, or '/clear' to clear history.");

  let userInput;
  while (true) {
    userInput = await getUserInput('You: ');

    if (userInput.toLowerCase() === '/exit' || userInput.toLowerCase() === '/quit') {
      displayMessage('Exiting Claude CLI. Goodbye!');
      break;
    }

    if (userInput.toLowerCase() === '/clear') {
      clearScreen();
      conversationHistory.length = 0; // Clear the history array
      displayMessage('Screen and conversation history cleared.');
      continue; // Skip the rest of the loop and prompt for new input
    }

    conversationHistory.push({ role: 'user', content: userInput });

    const spinner = ora({ text: chalk.magenta('Claude is thinking...'), spinner: 'dots' }).start();

    try {
      const assistantResponse = await getClaudeResponse(userInput, conversationHistory.slice(0, -1));
      
      if (assistantResponse) {
        spinner.succeed(chalk.green('Claude responded:'));
        displayAssistantResponse(assistantResponse);
        conversationHistory.push({ role: 'assistant', content: assistantResponse });
      } else {
        spinner.fail(chalk.red('Claude did not respond.'));
        displayMessage(
          'Sorry, I encountered an error or could not get a response. Please try again.'
        );
      }
    } catch (error) {
      spinner.fail(chalk.red('Error during API call.'));
      console.error('API call failed:', error);
      displayMessage('An error occurred while talking to Claude. Check console for details.');
    }
  }

  closeCLI();
}

// Start the chat application
chat().catch((error) => {
  console.error('An unexpected error occurred in chat():', error);
  closeCLI(); // Ensure CLI is closed even on unexpected errors
  process.exit(1);
}); 