import axios from 'axios';


const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_NAME = 'claude-3-7-sonnet-latest'; // Or the specific version like claude-3-7-sonnet-20250219
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 2048; // Default max tokens

/**
 * Sends a message to the Anthropic Claude API and returns an async iterator for the assistant's response.
 * @param {string} userMessage The latest message from the user.
 * @param {Array<{role: string, content: string}>} conversationHistory An array of previous messages in the conversation.
 * @returns {AsyncGenerator<string, void, unknown>|null} An async iterator yielding text chunks, or null if an error occurs.
 */
export async function* getClaudeResponse(userMessage, conversationHistory = []) {
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
      // console.log('[API DEBUG] Current raw chunk received:', JSON.stringify(currentChunkString));
      const chunkText = partialLine + currentChunkString;
      // console.log('[API DEBUG] Accumulated chunkText (partialLine + currentChunk):', JSON.stringify(chunkText));
      
      const lines = chunkText.split('\n');
      // console.log(`[API DEBUG] Lines array length before pop(): ${lines.length}. Content: ${JSON.stringify(lines)}`);
      
      if (lines.length > 0) {
        partialLine = lines.pop() || ''; // Save the last line, which might be incomplete
      } else {
        partialLine = ''; // Should not happen if chunkText is not empty
      }
      // console.log(`[API DEBUG] Lines array length after pop(): ${lines.length}.`);
      // console.log(`[API DEBUG] partialLine is now: ${JSON.stringify(partialLine)}`);

      if (lines.length > 0) {
        // console.log(`[API DEBUG] Entering inner loop to process ${lines.length} line(s).`);
        for (const line of lines) {
          // console.log('[API DEBUG] Inner loop: Processing line:', JSON.stringify(line));
          if (line.trim() === '') {
            // console.log('[API DEBUG] Inner loop: Line is empty or whitespace, skipping.');
            continue;
          }
          if (line.startsWith('data: ')) {
            const jsonData = line.substring(5).trim();
            // console.log('[API DEBUG] Inner loop: JSON data string:', jsonData);
            try {
              const data = JSON.parse(jsonData);
              // console.log('[API DEBUG] Inner loop: Parsed data event:', JSON.stringify(data, null, 2));
              if (data.type === 'content_block_delta') {
                if (data.delta && data.delta.type === 'text_delta') {
                  // console.log('[API DEBUG] Inner loop: Yielding text_delta:', data.delta.text);
                  yield data.delta.text;
                }
              } else if (data.type === 'message_stop') {
                // console.log('[API DEBUG] Inner loop: Message stop event received.');
                return; 
              }
            } catch (parseError) {
              // console.error('[API DEBUG] Inner loop: JSON parsing error:', parseError, 'on data:', jsonData);
            }
          }
        }
        // console.log('[API DEBUG] Exited inner loop.');
      } else {
        // console.log('[API DEBUG] Inner loop skipped because lines array is empty after pop.');
      }
    }

    // Process any remaining data in partialLine after the stream ends
    if (partialLine.trim() !== '') {
        // console.log('[API DEBUG] Processing remaining partialLine at end of stream:', JSON.stringify(partialLine));
        if (partialLine.startsWith('data: ')) {
            const jsonData = partialLine.substring(5).trim();
            try {
                const data = JSON.parse(jsonData);
                // console.log('[API DEBUG] End of stream: Parsed data from partialLine:', JSON.stringify(data, null, 2));
                if (data.type === 'content_block_delta' && data.delta && data.delta.type === 'text_delta') {
                    // console.log('[API DEBUG] End of stream: Yielding text_delta from partialLine:', data.delta.text);
                    yield data.delta.text;
                } else if (data.type === 'message_stop') {
                    // console.log('[API DEBUG] End of stream: Message stop event received in partialLine.');
                    return;
                }
            } catch (parseError) {
                // console.error('[API DEBUG] End of stream: JSON parsing error on partialLine:', parseError, 'on data:', jsonData);
            }
        }
    }
    // console.log('[API DEBUG] Stream processing finished.');
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
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
      // The request was made but no response was received
      console.error('Error calling Anthropic API: No response received', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error calling Anthropic API:', error.message);
    }
    // In case of an error, we yield nothing, and the calling function should handle it.
    // Alternatively, throw the error or return a specific error indicator if preferred.
    return null; 
  }
} 