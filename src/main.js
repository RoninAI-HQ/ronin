const { getClaudeResponse } = require('./api');
const {
  initializeCLI,
  getUserInput,
  displayAssistantResponse,
  displayMessage,
  closeCLI,
} = require('./cli');

// Stores the conversation history. Each element is an object: { role: 'user'|'assistant', content: string }
const conversationHistory = [];

async function chat() {
  initializeCLI();
  displayMessage("Welcome to Claude CLI! Type 'exit' or 'quit' to end the chat.");

  let userInput;
  while (true) {
    userInput = await getUserInput('You: ');

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      displayMessage('Exiting Claude CLI. Goodbye!');
      break; 
    }

    // Add user's message to history before calling API
    conversationHistory.push({ role: 'user', content: userInput });

    // Display a thinking message while waiting for the API
    // displayMessage('Claude is thinking...'); // Consider adding this for better UX

    const assistantResponse = await getClaudeResponse(userInput, conversationHistory.slice(0, -1)); // Send history *before* current user message

    if (assistantResponse) {
      displayAssistantResponse(assistantResponse);
      // Add assistant's response to history
      conversationHistory.push({ role: 'assistant', content: assistantResponse });
    } else {
      displayMessage(
        'Sorry, I encountered an error or could not get a response. Please try again.'
      );
      // Optionally, remove the last user message from history if the API call failed critically
      // so it's not resent in a broken state on the next turn.
      // For now, we'll keep it, assuming it might be a transient issue.
    }
  }

  closeCLI();
}

// Start the chat application
chat().catch((error) => {
  console.error('An unexpected error occurred:', error);
  closeCLI(); // Ensure CLI is closed even on unexpected errors
  process.exit(1);
}); 