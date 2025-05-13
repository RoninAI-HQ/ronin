import readline from 'readline';
import chalk from 'chalk';

let rl; // To store the readline interface instance

/**
 * Initializes and returns a readline interface for CLI interaction.
 * If an interface already exists, it returns the existing one.
 */
export function initializeCLI() {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
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
  if (!rl) initializeCLI();
  return new Promise((resolve) => {
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
    // rl = null; // Optionally reset rl if you might reinitialize later in a more complex app
  }
} 