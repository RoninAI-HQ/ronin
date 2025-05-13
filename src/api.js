const axios = require('axios');
const { apiKey } = require('./config');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_NAME = 'claude-3-7-sonnet-latest'; // Or the specific version like claude-3-7-sonnet-20250219
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 2048; // Default max tokens

/**
 * Sends a message to the Anthropic Claude API and returns the assistant's response.
 * @param {string} userMessage The latest message from the user.
 * @param {Array<{role: string, content: string}>} conversationHistory An array of previous messages in the conversation.
 * @returns {Promise<string|null>} The assistant's response text, or null if an error occurs.
 */
async function getClaudeResponse(userMessage, conversationHistory = []) {
  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: MODEL_NAME,
        max_tokens: MAX_TOKENS,
        messages: messages,
        // system: "You are a helpful AI assistant.", // Optional system prompt
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
      }
    );

    // According to Anthropic docs, response.data.content is an array.
    // For simple text, the first element should have type "text" and the text content.
    if (response.data && response.data.content && response.data.content.length > 0) {
      const firstContent = response.data.content[0];
      if (firstContent && firstContent.type === 'text' && firstContent.text) {
        return firstContent.text;
      }
    }
    console.error('Error: Unexpected response structure from Anthropic API:', response.data);
    return null;

  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error calling Anthropic API:', error.response.status, error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Error calling Anthropic API: No response received', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error calling Anthropic API:', error.message);
    }
    return null; // Indicate an error occurred
  }
}

module.exports = {
  getClaudeResponse,
}; 