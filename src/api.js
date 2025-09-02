import axios from 'axios';


const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_NAME = 'claude-sonnet-4-20250514'; // Or the specific version like claude-3-7-sonnet-20250219
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 2048; // Default max tokens

/**
 * Sends a message to the Anthropic Claude API and returns an async iterator for the assistant's response.
 * @param {string} userMessage The latest message from the user.
 * @param {Array<{role: string, content: string}>} conversationHistory An array of previous messages in the conversation.
 * @returns {AsyncGenerator<string, void, unknown>|null} An async iterator yielding text chunks, or null if an error occurs.
 */
export async function* getClaudeResponse(userMessage, conversationHistory = []) {
  // Ensure API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('API key not configured');
  }
  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // console.log('[API DEBUG] Sending request to Anthropic:', messages);

  try {
    const response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: MODEL_NAME,
        max_tokens: MAX_TOKENS,
        messages: messages,
        stream: true, // Enable streaming
        // system: "You are a helpful AI assistant.", // Optional system prompt
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        responseType: 'stream', // Important for axios to handle the stream
      }
    );

    // console.log('[API DEBUG] Stream response received, processing data...');
    let partialLine = '';

    for await (const chunk of response.data) {
      const currentChunkString = chunk.toString('utf8');
      const chunkText = partialLine + currentChunkString;
      
      const lines = chunkText.split('\n');
      
      if (lines.length > 0) {
        partialLine = lines.pop() || ''; // Save the last line, which might be incomplete
      } else {
        partialLine = ''; // Should not happen if chunkText is not empty
      }

      if (lines.length > 0) {
        for (const line of lines) {
          if (line.trim() === '') {
            continue;
          }
          if (line.startsWith('data: ')) {
            const jsonData = line.substring(5).trim();
            try {
              const data = JSON.parse(jsonData);
              if (data.type === 'content_block_delta') {
                if (data.delta && data.delta.type === 'text_delta') {
                  yield data.delta.text;
                }
              } else if (data.type === 'message_stop') {
                return; 
              }
            } catch (parseError) {
            }
          }
        }
      }
    }

    // Process any remaining data in partialLine after the stream ends
    if (partialLine.trim() !== '') {
        if (partialLine.startsWith('data: ')) {
            const jsonData = partialLine.substring(5).trim();
            try {
                const data = JSON.parse(jsonData);
                if (data.type === 'content_block_delta' && data.delta && data.delta.type === 'text_delta') {
                    yield data.delta.text;
                } else if (data.type === 'message_stop') {
                    return;
                }
            } catch (parseError) {
                // console.error('[API DEBUG] End of stream: JSON parsing error on partialLine:', parseError, 'on data:', jsonData);
            }
        }
    }
    
  } catch (error) {
    if (error.response) {
      console.error('Error calling Anthropic API:', error.response.status, error.response.data);
      // Attempt to read the stream for more detailed error information if available
      if (error.response.data && typeof error.response.data.on === 'function') {
        let errorData = '';
        for await (const chunk of error.response.data) {
          errorData += chunk.toString('utf8');
        }
        console.error('Error stream data:', errorData);
      }
    } else if (error.request) {
      console.error('Error calling Anthropic API: No response received', error.request);
    } else {
      console.error('Error calling Anthropic API:', error.message);
    }

    return null; 
  }
} 