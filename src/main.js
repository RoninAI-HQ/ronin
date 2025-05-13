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

// Stores the conversation history. Each element is an object: { role: 'user'|'assistant', content: string }
const conversationHistory = [];

async function chat() {
  initializeCLI();
  displayMessage("Welcome to Claude CLI! Type '/exit' or '/quit' to end the chat, or '/clear' to clear history.");

  let userInput;
  while (true) {
    userInput = await getUserInput('\n> ');

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

    process.stdout.write(chalk.magenta('Claude is thinking...'));

    try {
      const assistantResponseStream = getClaudeResponse(userInput, conversationHistory.slice(0, -1));
      
      // Clear the text-based loading message once the stream starts
      process.stdout.write('\r' + ' '.repeat('Claude is thinking...'.length) + '\r');
      
      let fullAssistantResponse = '';
      if (assistantResponseStream) {
        // Indicate assistant is replying
        process.stdout.write(chalk.hex('#888')('\nAssistant: ')); 
        for await (const chunk of assistantResponseStream) {
          if (chunk) { // Ensure chunk is not null or undefined
            streamAssistantResponse(chunk); // New function in cli.js to stream chunks
            fullAssistantResponse += chunk;
          }
        }
        streamAssistantResponse('\n'); // Add a newline at the end of the streamed response
        if (fullAssistantResponse) {
            conversationHistory.push({ role: 'assistant', content: fullAssistantResponse });
        } else {
             // Handle cases where the stream might have been valid but empty or only yielded null/undefined chunks
            displayMessage(
                'Claude responded, but the message was empty. Please try again.'
            );
        }
      } else {
        displayMessage(
          'Sorry, I encountered an error or could not get a response. Please try again.'
        );
      }
    } catch (error) {
      process.stdout.write('\r' + ' '.repeat('Claude is thinking...'.length) + '\r');
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