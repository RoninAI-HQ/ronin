import readline from 'readline';
import chalk from 'chalk';

let rl; // To store the readline interface instance

/**
 * Initializes and returns a readline interface for CLI interaction.
 * If an interface already exists and is open, it returns the existing one.
 * If it's closed or doesn't exist, it creates a new one.
 */
export function initializeCLI() {
  if (!rl) { // Check if rl is null or undefined (it will be if closed by the event listener)
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // When the interface closes, set rl to null so it can be re-initialized
    rl.on('close', () => {
      // console.log(chalk.dim('Readline interface closed. Will re-initialize if needed.'));
      rl = null;
    });
  }
  return rl;
}

/**
 * Prompts the user for input.
 * @param {string} promptText The text to display as the prompt (e.g., "You: ").
 * @returns {Promise<string>} A promise that resolves with the user's input.
 */
export function getUserInput(promptText = 'You: ') {
  initializeCLI(); // Ensure rl is initialized or re-initialized if it was closed
  return new Promise((resolve, reject) => {
    if (!rl) {
      // This should ideally not happen if initializeCLI works correctly,
      // but as a safeguard:
      return reject(new Error('Readline interface could not be initialized.'));
    }
    rl.question(chalk.green(promptText), (input) => {
      resolve(input);
    });
  });
}

/**
 * Displays a message from the assistant.
 * @param {string} message The message to display (e.g., Claude's response).
 */
export function displayAssistantResponse(message) {
  console.log(`${chalk.blue('Claude:')} ${message}`);
}

/**
 * Displays a general message to the console.
 * @param {string} message The message to display.
 */
export function displayMessage(message) {
  console.log(chalk.yellow(message));
}

/**
 * Streams a chunk of the assistant's response to the console.
 * @param {string} chunk The text chunk to display.
 */
export function streamAssistantResponse(chunk) {
  // Apply any desired styling to the chunk, e.g., chalk.blue(chunk)
  // For now, just write the chunk as is. Styling is handled in main.js for the "Assistant: " prefix.
  process.stdout.write(chalk.cyan(chunk)); 
}

/**
 * Clears the terminal screen.
 */
export function clearScreen() {
  console.clear();
}

/**
 * Closes the readline interface.
 */
export function closeCLI() {
  if (rl) {
    rl.close();
    // rl is set to null by the 'close' event listener now
  }
} 