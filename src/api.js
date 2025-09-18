import axios from 'axios';
import { ToolResultFormatter } from './utils/ToolResultFormatter.js';
import { LLMProviderManager } from './providers/LLMProviderManager.js';


const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_NAME = 'claude-sonnet-4-20250514'; // Or the specific version like claude-3-7-sonnet-20250219
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 2048; // Default max tokens

// Global LLM provider manager
let llmProviderManager = null;

export async function initializeLLMProvider(config) {
  if (!llmProviderManager) {
    llmProviderManager = new LLMProviderManager();
  }
  await llmProviderManager.initialize(config);
  return llmProviderManager;
}

export function getLLMProviderManager() {
  return llmProviderManager;
}

/**
 * Sends a message to the Anthropic Claude API and returns an async iterator for the assistant's response.
 * @param {string} userMessage The latest message from the user.
 * @param {Array<{role: string, content: string}>} conversationHistory An array of previous messages in the conversation.
 * @param {Array} tools Available MCP tools for Claude to use.
 * @param {Object} mcpManager MCP Manager instance for executing tools.
 * @returns {AsyncGenerator<string, void, unknown>|null} An async iterator yielding text chunks, or null if an error occurs.
 */
export async function* getClaudeResponse(userMessage, conversationHistory = [], tools = null, mcpManager = null) {
  // Check if we're using a local provider
  if (llmProviderManager && llmProviderManager.isLocalProvider()) {
    yield* getLocalLLMResponse(userMessage, conversationHistory, tools, mcpManager);
    return;
  }

  // Ensure API key is available for Anthropic
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('API key not configured');
  }

  let messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // console.log('[API DEBUG] Sending request to Anthropic:', messages);

  // We might need multiple rounds of conversation if tools are used
  let conversationComplete = false;

  while (!conversationComplete) {
    // Prepare request payload
    const requestPayload = {
      model: MODEL_NAME,
      max_tokens: MAX_TOKENS,
      messages: messages,
      stream: true, // Enable streaming
      // system: "You are a helpful AI assistant.", // Optional system prompt
    };

    // Add tools to the request if available
    if (tools && tools.length > 0) {
      requestPayload.tools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema
      }));
      requestPayload.tool_choice = { type: 'auto' };
    }

    try {
      const response = await axios.post(
        ANTHROPIC_API_URL,
        requestPayload,
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
      let toolUseBlocks = [];
      let currentToolUse = null;
      let assistantResponse = '';
      let usedTools = false;

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

              if (data.type === 'content_block_start') {
                if (data.content_block && data.content_block.type === 'tool_use') {
                  currentToolUse = {
                    id: data.content_block.id,
                    name: data.content_block.name,
                    input: ''
                  };
                  usedTools = true;
                }
              } else if (data.type === 'content_block_delta') {
                if (data.delta && data.delta.type === 'text_delta') {
                  assistantResponse += data.delta.text;
                  yield data.delta.text;
                } else if (data.delta && data.delta.type === 'input_json_delta' && currentToolUse) {
                  currentToolUse.input += data.delta.partial_json;
                }
              } else if (data.type === 'content_block_stop') {
                if (currentToolUse) {
                  // Parse and execute the tool
                  try {
                    const toolInput = JSON.parse(currentToolUse.input);

                    if (mcpManager) {
                      yield `\n\n*🔄 Executing tool: **${currentToolUse.name}***\n\n`;

                      const result = await mcpManager.executeTool(currentToolUse.name, toolInput);

                      // Format the result using the intelligent formatter
                      const formattedResult = ToolResultFormatter.formatResult(
                        currentToolUse.name,
                        toolInput,
                        result
                      );

                      yield formattedResult;

                      // Store tool use for conversation
                      toolUseBlocks.push({
                        type: 'tool_use',
                        id: currentToolUse.id,
                        name: currentToolUse.name,
                        input: toolInput,
                        result: result
                      });
                    }
                  } catch (error) {
                    const errorResult = ToolResultFormatter.formatResult(
                      currentToolUse?.name || 'unknown',
                      {},
                      { error: error.message, isError: true }
                    );
                    yield errorResult;

                    // Store error for conversation
                    toolUseBlocks.push({
                      type: 'tool_use',
                      id: currentToolUse.id,
                      name: currentToolUse.name,
                      input: JSON.parse(currentToolUse.input),
                      result: { error: error.message, isError: true }
                    });
                  }
                  currentToolUse = null;
                }
              } else if (data.type === 'message_stop') {
                break; // Exit the streaming loop, but continue to process tools
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
                      assistantResponse += data.delta.text;
                      yield data.delta.text;
                  }
              } catch (parseError) {
                  // console.error('[API DEBUG] End of stream: JSON parsing error on partialLine:', parseError, 'on data:', jsonData);
              }
          }
      }

      // After streaming is complete, handle tool results if any were used
      if (usedTools && toolUseBlocks.length > 0) {
        // Add assistant's response (which included tool_use blocks) to conversation
        const assistantContent = [];

        // Add any text response first
        if (assistantResponse.trim()) {
          assistantContent.push({
            type: 'text',
            text: assistantResponse
          });
        }

        // Add tool use blocks
        for (const toolBlock of toolUseBlocks) {
          assistantContent.push({
            type: 'tool_use',
            id: toolBlock.id,
            name: toolBlock.name,
            input: toolBlock.input
          });
        }

        messages.push({
          role: 'assistant',
          content: assistantContent
        });

        // Add tool results as user messages
        for (const toolBlock of toolUseBlocks) {
          const resultForApi = typeof toolBlock.result === 'string' ? toolBlock.result :
                             toolBlock.result.text ? toolBlock.result.text :
                             JSON.stringify(toolBlock.result, null, 2);

          messages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: resultForApi
            }]
          });
        }

        // Continue the conversation loop to get Claude's response to the tool results
        // Reset for next iteration
        yield `\n\n---\n\n`; // Visual separator for Claude's follow-up response
      } else {
        // No tools used, conversation is complete
        conversationComplete = true;
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
  } // End of while loop
}

async function* getLocalLLMResponse(userMessage, conversationHistory = [], tools = null, mcpManager = null) {
  try {
    const provider = llmProviderManager.getProvider();
    if (!provider) {
      throw new Error('Local LLM provider not initialized');
    }

    // Combine conversation history with the new message
    const messages = [
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    // Stream response from local LLM
    let fullResponse = '';
    for await (const chunk of provider.streamResponse(messages, tools)) {
      fullResponse += chunk;
      yield chunk;

      // Check if the response contains a tool use pattern
      // This is a simple implementation - you might want to enhance this
      if (tools && tools.length > 0 && fullResponse.includes('TOOL_USE:')) {
        const toolUseMatch = fullResponse.match(/TOOL_USE:\s*({[^}]+})/);
        if (toolUseMatch) {
          try {
            const toolCall = JSON.parse(toolUseMatch[1]);
            if (mcpManager && toolCall.name && toolCall.parameters) {
              yield `\n\n*🔄 Executing tool: **${toolCall.name}***\n\n`;

              const result = await mcpManager.executeTool(toolCall.name, toolCall.parameters);
              const formattedResult = ToolResultFormatter.formatResult(
                toolCall.name,
                toolCall.parameters,
                result
              );

              yield formattedResult;

              // Continue conversation with tool result
              const toolResultMessage = `Tool ${toolCall.name} returned: ${JSON.stringify(result)}`;
              const continuationMessages = [
                ...messages,
                { role: 'assistant', content: fullResponse },
                { role: 'user', content: toolResultMessage }
              ];

              yield '\n\n---\n\n';

              // Get follow-up response
              for await (const chunk of provider.streamResponse(continuationMessages, tools)) {
                yield chunk;
              }
            }
          } catch (error) {
            yield `\n\nError executing tool: ${error.message}\n\n`;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error with local LLM:', error);
    throw new Error(`Local LLM error: ${error.message}`);
  }
} 