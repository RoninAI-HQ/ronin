#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';
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

// Function to load application configuration
function loadAppConfig() {
  const homeDir = os.homedir();
  const primaryConfigPath = path.join(homeDir, '.ronin', 'ronin.config');
  const fallbackConfigPath = path.resolve(process.cwd(), 'ronin.config');

  let configPathToLoad;

  if (fs.existsSync(primaryConfigPath)) {
    configPathToLoad = primaryConfigPath;
  } else if (fs.existsSync(fallbackConfigPath)) {
    configPathToLoad = fallbackConfigPath;
  }

  if (configPathToLoad) {
    dotenv.config({ path: configPathToLoad });
    // console.log(`Configuration loaded from: ${configPathToLoad}`); // Optional: for debugging
  } else {
    // console.log('No ronin.config file found in ~/.ronin/ or PWD.'); // Optional: for debugging
  }
}

// Load configuration at the start
loadAppConfig();

async function chat() {
  initializeCLI();
  displayMessage("Welcome to Ronin CLI! Type '/help' for a list of commands, '/exit' or '/quit' to end the chat, '/save' to save conversation, '/load' to load a conversation, '/new' to start a new one (saves current), or '/clear' to clear screen.");

  let userInput;
  spinnerInstance = new Spinner('%s ');
  spinnerInstance.setSpinnerString(18);

  while (true) {
    console.log("");
    userInput = await getUserInput('> ');

    if (userInput.toLowerCase() === '/exit' || userInput.toLowerCase() === '/quit') {
      displayMessage('Exiting Claude CLI. Goodbye!');
      break;
    }

    if (userInput.toLowerCase() === '/help') {
      const helpText = `
Available commands:
  /help          - Show this help message.
  /exit, /quit   - Exit the Ronin CLI.
  /save          - Save the current conversation to a JSON file.
  /load list     - List saved conversation files in the current directory.
  /load [path]   - Load a conversation from the specified JSON file.
  /new           - Save current conversation, then start a new one (clears screen and history).
  /clear         - Clear the terminal screen.
      `;
      displayMessage(helpText);
      continue;
    }

    if (userInput.toLowerCase().startsWith('/load')) {
      const parts = userInput.trim().split(' ');
      const loadArg = parts.length > 1 ? parts[1].toLowerCase() : '';

      if (loadArg === 'list') {
        try {
          const files = fs.readdirSync(process.cwd());
          const convoFiles = files.filter(file => /^convo__.*\.json$/.test(file));
          if (convoFiles.length > 0) {
            displayMessage('Saved conversation files:\n' + convoFiles.join('\n'));
          } else {
            displayMessage('No saved conversation files found in the current directory.');
          }
        } catch (error) {
          console.error('Error listing conversation files:', error);
          displayMessage('Error listing conversation files. Check console for details.');
        }
        continue;
      } else if (loadArg) {
        const filePath = path.resolve(process.cwd(), loadArg);
        try {
          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const loadedHistory = JSON.parse(fileContent);
            if (Array.isArray(loadedHistory)) {
              conversationHistory.length = 0; // Clear current history
              conversationHistory.push(...loadedHistory); // Load new history
              displayMessage(`Conversation loaded from ${loadArg}.`);
              // Optionally, display a snippet of the loaded conversation
              if (loadedHistory.length > 0) {
                const lastMessage = loadedHistory[loadedHistory.length -1];
                displayMessage(`Last message: [${lastMessage.role}] ${lastMessage.content.substring(0, 50)}...`);
              }
            } else {
              displayMessage('Invalid conversation file format. Expected a JSON array.');
            }
          } else {
            displayMessage(`File not found: ${loadArg}`);
          }
        } catch (error) {
          console.error('Error loading conversation file:', error);
          displayMessage('Error loading conversation file. It might be corrupted or not valid JSON. Check console.');
        }
        continue;
      } else {
        displayMessage("Usage: /load list OR /load [filepath]");
        continue;
      }
    }

    if (userInput.toLowerCase() === '/clear') {
      clearScreen();
      displayMessage('Screen cleared.');
      continue;
    }

    if (userInput.toLowerCase() === '/new') {
      // Save conversation before clearing
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const fileName = `convo__${day}_${month}_${year}__${hours}_${minutes}_${seconds}.json`;
      const filePath = path.join(process.cwd(), fileName);

      try {
        if (conversationHistory.length > 0) { // Only save if there's something to save
          fs.writeFileSync(filePath, JSON.stringify(conversationHistory, null, 2));
          displayMessage(`Conversation history saved to ${fileName}`);
        }
      } catch (error) {
        console.error('Failed to save conversation history:', error);
        displayMessage('Error saving conversation history before starting new. Check console for details.');
      }

      clearScreen();
      conversationHistory.length = 0; // Clear history after saving and clearing screen
      displayMessage("New conversation started. Previous conversation saved (if not empty).");
      continue;
    }

    if (userInput.toLowerCase() === '/save') {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const fileName = `convo__${day}_${month}_${year}__${hours}_${minutes}_${seconds}.json`;
      const filePath = path.join(process.cwd(), fileName); // Save in the current working directory

      try {
        if (conversationHistory.length > 0) {
          fs.writeFileSync(filePath, JSON.stringify(conversationHistory, null, 2));
          displayMessage(`Conversation history saved to ${fileName}`);
        } else {
          displayMessage('Conversation history is empty. Nothing to save.');
        }
      } catch (error) {
        console.error('Failed to save conversation history:', error);
        displayMessage('Error saving conversation history. Check console for details.');
      }
      continue;
    }

    // If input is empty or only whitespace, skip and prompt again
    if (!userInput.trim()) {
      continue;
    }

    conversationHistory.push({ role: 'user', content: userInput });

    console.log("");
    spinnerInstance.start();

    try {
      const assistantResponseStream = getClaudeResponse(userInput, conversationHistory.slice(0, -1));
      
      let fullAssistantResponse = '';
      if (assistantResponseStream) {
        let isFirstChunk = true;
        for await (const chunk of assistantResponseStream) {
          if (isFirstChunk) {
            spinnerInstance.stop(true);
            process.stdout.write(chalk.hex('#888')('Ronin: '));
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