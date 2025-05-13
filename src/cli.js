const readline = require('readline');

let rl; // To store the readline interface instance

/**
 * Initializes and returns a readline interface for CLI interaction.
 * If an interface already exists, it returns the existing one.
 */
function initializeCLI() {
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
function getUserInput(promptText = 'You: ') {
  if (!rl) initializeCLI();
  return new Promise((resolve) => {
    rl.question(promptText, (input) => {
      resolve(input);
    });
  });
}

/**
 * Displays a message from the assistant.
 * @param {string} message The message to display (e.g., Claude's response).
 */
function displayAssistantResponse(message) {
  console.log(`Claude: ${message}`);
}

/**
 * Displays a general message to the console.
 * @param {string} message The message to display.
 */
function displayMessage(message) {
  console.log(message);
}

/**
 * Closes the readline interface.
 */
function closeCLI() {
  if (rl) {
    rl.close();
    // rl = null; // Optionally reset rl if you might reinitialize later in a more complex app
  }
}

module.exports = {
  initializeCLI,
  getUserInput,
  displayAssistantResponse,
  displayMessage,
  closeCLI,
}; 