import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import fs from 'fs';
import os from 'os';

export class NodeLlamaCppProvider {
  constructor(config = {}) {
    this.config = {
      modelPath: config.modelPath || null,
      modelName: config.modelName || 'llama3.2-3b-instruct',
      modelsDir: config.modelsDir || path.join(os.homedir(), '.ronin', 'models'),
      maxTokens: config.maxTokens || 2048,
      temperature: config.temperature || 0.7,
      contextSize: config.contextSize || 4096,
      gpuLayers: config.gpuLayers || 'auto', // Let node-llama-cpp auto-detect
      ...config
    };

    this.llama = null;
    this.model = null;
    this.context = null;
    this.session = null;
    this.isLoaded = false;
  }

  async initialize() {
    try {
      // Initializing llama.cpp
      this.llama = await getLlama();
      // llama.cpp initialized successfully
      return true;
    } catch (error) {
      // Failed to initialize
      throw new Error(`Failed to initialize node-llama-cpp: ${error.message}`);
    }
  }

  async checkAvailability() {
    try {
      if (!this.llama) {
        await this.initialize();
      }
      return { available: true };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  async ensureModelsDirectory() {
    if (!fs.existsSync(this.config.modelsDir)) {
      fs.mkdirSync(this.config.modelsDir, { recursive: true });
      // Created models directory
    }
  }

  async findModelFile(modelName) {
    await this.ensureModelsDirectory();

    // If specific model path is provided, use it
    if (this.config.modelPath && fs.existsSync(this.config.modelPath)) {
      return this.config.modelPath;
    }

    // Look for model files in the models directory
    const possibleExtensions = ['.gguf', '.ggml'];
    const possibleNames = [
      modelName,
      `${modelName}.Q4_K_M`,
      `${modelName}.q4_k_m`,
      `Meta-Llama-3.2-3B-Instruct.Q4_K_M`,
      `llama-3.2-3b-instruct.Q4_K_M`
    ];

    for (const name of possibleNames) {
      for (const ext of possibleExtensions) {
        const filePath = path.join(this.config.modelsDir, `${name}${ext}`);
        if (fs.existsSync(filePath)) {
          return filePath;
        }
      }
    }

    return null;
  }

  async loadModel(modelPath = null) {
    try {
      if (!this.llama) {
        await this.initialize();
      }

      const actualModelPath = modelPath || await this.findModelFile(this.config.modelName);

      if (!actualModelPath) {
        throw new Error(`Model not found. Please download a model first using /download command.`);
      }

      if (!fs.existsSync(actualModelPath)) {
        throw new Error(`Model file not found: ${actualModelPath}`);
      }

      // Loading model

      const loadOptions = {
        modelPath: actualModelPath
      };

      // Add GPU layers if specified
      if (this.config.gpuLayers !== 'auto') {
        loadOptions.gpuLayers = this.config.gpuLayers;
      }

      this.model = await this.llama.loadModel(loadOptions);

      // Creating context
      this.context = await this.model.createContext({
        contextSize: this.config.contextSize
      });

      this.session = new LlamaChatSession({
        contextSequence: this.context.getSequence()
      });

      this.isLoaded = true;
      // Model loaded successfully

      return {
        success: true,
        modelPath: actualModelPath,
        modelName: path.basename(actualModelPath)
      };
    } catch (error) {
      // Failed to load model
      throw new Error(`Failed to load model: ${error.message}`);
    }
  }

  async unloadModel() {
    try {
      if (this.session) {
        this.session = null;
      }
      if (this.context) {
        await this.context.dispose();
        this.context = null;
      }
      if (this.model) {
        await this.model.dispose();
        this.model = null;
      }
      this.isLoaded = false;
      // Model unloaded successfully
    } catch (error) {
      // Error unloading model
    }
  }

  async listLocalModels() {
    await this.ensureModelsDirectory();

    try {
      const files = fs.readdirSync(this.config.modelsDir);
      const modelFiles = files.filter(file =>
        file.endsWith('.gguf') || file.endsWith('.ggml')
      ).map(file => {
        const filePath = path.join(this.config.modelsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: this.formatFileSize(stats.size),
          modified: stats.mtime
        };
      });

      return modelFiles;
    } catch (error) {
      // Error listing models
      return [];
    }
  }

  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatMessagesForNodeLlamaCpp(messages) {
    // Convert messages to the format expected by LlamaChatSession
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        return {
          type: msg.role === 'assistant' ? 'model' : 'user',
          text: msg.content
        };
      } else if (Array.isArray(msg.content)) {
        // Handle complex content (like tool results)
        const textContent = msg.content
          .filter(c => c.type === 'text' || c.type === 'tool_result')
          .map(c => c.text || c.content || JSON.stringify(c))
          .join('\\n');
        return {
          type: msg.role === 'assistant' ? 'model' : 'user',
          text: textContent
        };
      }
      return {
        type: msg.role === 'assistant' ? 'model' : 'user',
        text: JSON.stringify(msg)
      };
    });
  }

  async *streamResponse(messages, tools = null) {
    try {
      if (!this.isLoaded) {
        await this.loadModel();
      }

      if (!this.session) {
        throw new Error('Model session not available. Please load a model first.');
      }

      // Get the latest user message
      const latestMessage = messages[messages.length - 1];
      if (!latestMessage || latestMessage.role !== 'user') {
        throw new Error('No user message found');
      }

      let prompt = latestMessage.content;
      if (typeof prompt !== 'string') {
        // Handle complex content
        if (Array.isArray(prompt)) {
          prompt = prompt
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\\n');
        } else {
          prompt = JSON.stringify(prompt);
        }
      }

      // Add tool information to prompt if tools are available
      if (tools && tools.length > 0) {
        const toolDescriptions = tools.map(t =>
          `Tool: ${t.name}\\nDescription: ${t.description}\\nParameters: ${JSON.stringify(t.inputSchema)}`
        ).join('\\n\\n');

        prompt = `You have access to the following tools:\\n\\n${toolDescriptions}\\n\\nWhen you need to use a tool, respond with: TOOL_USE: {"name": "tool_name", "parameters": {...}}\\n\\nUser request: ${prompt}`;
      }

      // Stream the response
      const response = await this.session.prompt(prompt, {
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        onTextChunk: (chunk) => {
          // This callback is called for each token generated
        }
      });

      // Since node-llama-cpp doesn't support real streaming yet,
      // we'll simulate streaming by yielding chunks of the response
      const chunkSize = 3; // Yield every 3 characters for smoother streaming effect
      for (let i = 0; i < response.length; i += chunkSize) {
        const chunk = response.slice(i, i + chunkSize);
        yield chunk;
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10));
      }

    } catch (error) {
      // Error generating response
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  async generateResponse(messages, tools = null) {
    let fullResponse = '';
    for await (const chunk of this.streamResponse(messages, tools)) {
      fullResponse += chunk;
    }
    return fullResponse;
  }

  getModelInfo() {
    if (!this.isLoaded || !this.model) {
      return { loaded: false };
    }

    return {
      loaded: true,
      modelPath: this.config.modelPath,
      modelName: this.config.modelName,
      contextSize: this.config.contextSize,
      isGpuAccelerated: this.model.gpu || false
    };
  }

  async downloadModel(modelName, progressCallback = null) {
    // This is a placeholder for model downloading functionality
    // In a real implementation, you would integrate with Hugging Face API
    // or provide instructions for manual download
    throw new Error('Model downloading not implemented yet. Please manually download GGUF models to the models directory.');
  }
}