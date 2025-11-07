import { OllamaProvider } from './OllamaProvider.js';
import { NodeLlamaCppProvider } from './NodeLlamaCppProvider.js';
import { ModelManager } from '../services/ModelManager.js';

export class LLMProviderManager {
  constructor() {
    this.provider = null;
    this.providerType = null;
    this.config = {};
    this.modelManager = null;
  }

  async initialize(config) {
    this.config = config;
    this.providerType = config.provider || 'anthropic';

    if (this.providerType === 'ollama') {
      this.provider = new OllamaProvider({
        baseUrl: config.ollamaBaseUrl || 'http://localhost:11434',
        model: config.ollamaModel || 'llama3.2:3b',
        maxTokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7
      });

      // Check if Ollama is available
      const availability = await this.provider.checkAvailability();
      if (!availability.available) {
        throw new Error('Ollama is not available. Please start Ollama or use Anthropic provider.');
      }

      // Using Ollama provider
    } else if (this.providerType === 'inline-llm') {
      this.modelManager = new ModelManager({
        modelsDir: config.inlineModelsDir
      });

      this.provider = new NodeLlamaCppProvider({
        modelPath: config.inlineModelPath,
        modelName: config.inlineModelName || 'llama3.2-3b-instruct',
        modelsDir: config.inlineModelsDir,
        maxTokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7,
        contextSize: config.contextSize || 4096,
        gpuLayers: config.gpuLayers || 'auto'
      });

      // Initialize the provider
      await this.provider.initialize();

      // Using Inline Local LLM provider
    } else {
      this.providerType = 'anthropic';
      // Using Anthropic Claude provider
    }
  }

  getProviderType() {
    return this.providerType;
  }

  isLocalProvider() {
    return this.providerType === 'ollama' || this.providerType === 'inline-llm';
  }

  getProvider() {
    return this.provider;
  }

  async listAvailableModels() {
    if (this.providerType === 'ollama' && this.provider) {
      return await this.provider.listModels();
    } else if (this.providerType === 'inline-llm' && this.provider) {
      return await this.provider.listLocalModels();
    }
    return [];
  }

  async pullModel(modelName) {
    if (this.providerType === 'ollama' && this.provider) {
      return await this.provider.pullModel(modelName);
    } else if (this.providerType === 'inline-llm' && this.modelManager) {
      return await this.modelManager.downloadModel(modelName);
    }
    throw new Error('Model pulling is only available for Ollama and Inline LLM providers');
  }

  async switchProvider(providerType, config = {}) {
    // Clean up current provider
    if (this.provider && this.providerType === 'inline-llm' && this.provider.unloadModel) {
      await this.provider.unloadModel();
    }

    const mergedConfig = { ...this.config, ...config, provider: providerType };
    await this.initialize(mergedConfig);
  }

  getModelManager() {
    return this.modelManager;
  }

  async getModelInfo() {
    if (this.providerType === 'inline-llm' && this.provider) {
      return this.provider.getModelInfo();
    }
    return { loaded: false };
  }

  async loadModel(modelName = null) {
    if (this.providerType === 'inline-llm' && this.provider) {
      if (modelName && this.modelManager) {
        const modelPath = this.modelManager.getModelPath(modelName);
        if (modelPath) {
          return await this.provider.loadModel(modelPath);
        } else {
          throw new Error(`Model not found: ${modelName}`);
        }
      }
      return await this.provider.loadModel();
    }
    throw new Error('Model loading is only available for Inline LLM provider');
  }

  async unloadModel() {
    if (this.providerType === 'inline-llm' && this.provider) {
      return await this.provider.unloadModel();
    }
    throw new Error('Model unloading is only available for Inline LLM provider');
  }

  getModelName() {
    if (this.providerType === 'ollama') {
      return this.config.ollamaModel || 'llama3.2:3b';
    } else if (this.providerType === 'inline-llm') {
      return this.config.inlineModelName || 'llama3.2-3b-instruct';
    }
    return 'claude-sonnet-4-20250514';
  }

  async *streamResponse(messages, tools = null) {
    if (this.providerType === 'ollama' && this.provider) {
      yield* this.provider.streamResponse(messages, tools);
    } else if (this.providerType === 'inline-llm' && this.provider) {
      yield* this.provider.streamResponse(messages, tools);
    } else {
      // This will be handled by the existing Anthropic API logic
      throw new Error('Use getClaudeResponse for Anthropic provider');
    }
  }
}