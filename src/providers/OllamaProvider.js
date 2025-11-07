import axios from 'axios';

export class OllamaProvider {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama3.2:3b';
    this.maxTokens = config.maxTokens || 2048;
    this.temperature = config.temperature || 0.7;
  }

  async checkAvailability() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/version`);
      return { available: true, version: response.data.version };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  async listModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      throw new Error(`Failed to list Ollama models: ${error.message}`);
    }
  }

  async pullModel(modelName) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/pull`, {
        name: modelName,
        stream: false
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to pull model ${modelName}: ${error.message}`);
    }
  }

  formatMessagesForOllama(messages) {
    // Convert Anthropic-style messages to Ollama format
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        return {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        };
      } else if (Array.isArray(msg.content)) {
        // Handle complex content (like tool results)
        const textContent = msg.content
          .filter(c => c.type === 'text' || c.type === 'tool_result')
          .map(c => c.text || c.content || JSON.stringify(c))
          .join('\n');
        return {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: textContent
        };
      }
      return msg;
    });
  }

  async *streamResponse(messages, tools = null) {
    try {
      // Check if Ollama is running
      const availability = await this.checkAvailability();
      if (!availability.available) {
        throw new Error('Ollama is not running. Please start Ollama first.');
      }

      // Format messages for Ollama
      const formattedMessages = this.formatMessagesForOllama(messages);

      // Prepare the request
      const requestBody = {
        model: this.model,
        messages: formattedMessages,
        stream: true,
        options: {
          num_predict: this.maxTokens,
          temperature: this.temperature
        }
      };

      // Note: Ollama doesn't support tools/functions natively yet
      // We'll need to handle this through prompt engineering if needed
      if (tools && tools.length > 0) {
        // Add tool descriptions to the system message
        const toolDescriptions = tools.map(t =>
          `Tool: ${t.name}\nDescription: ${t.description}\nParameters: ${JSON.stringify(t.inputSchema)}`
        ).join('\n\n');

        formattedMessages.unshift({
          role: 'system',
          content: `You have access to the following tools:\n\n${toolDescriptions}\n\nWhen you need to use a tool, respond with: TOOL_USE: {"name": "tool_name", "parameters": {...}}`
        });
      }

      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        requestBody,
        {
          responseType: 'stream',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      let buffer = '';
      for await (const chunk of response.data) {
        buffer += chunk.toString();

        // Ollama sends newline-delimited JSON
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.message && data.message.content) {
                yield data.message.content;
              }
            } catch (error) {
              // Silently skip parsing errors
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.message && data.message.content) {
            yield data.message.content;
          }
        } catch (error) {
          // Silently skip parsing errors
        }
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Ollama. Please ensure Ollama is running (run "ollama serve" in a terminal).');
      }
      throw new Error(`Ollama API error: ${error.message}`);
    }
  }

  async generateResponse(messages, tools = null) {
    let fullResponse = '';
    for await (const chunk of this.streamResponse(messages, tools)) {
      fullResponse += chunk;
    }
    return fullResponse;
  }
}