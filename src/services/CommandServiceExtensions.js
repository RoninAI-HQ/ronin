import { getLLMProviderManager } from '../api.js';

// Additional command methods for inline LLM support
export const inlineLLMCommands = {
  async downloadModel(args) {
    if (!args) {
      const manager = getLLMProviderManager();
      const modelManager = manager?.getModelManager();
      if (modelManager) {
        const recommended = modelManager.getRecommendedModels();
        const list = recommended.map(m => `  - ${m.name}: ${m.displayName} (${m.size}) - ${m.description}`).join('\n');
        return {
          type: 'info',
          message: `Usage: /download [model-name]\n\nRecommended models:\n${list}\n\nExample: /download llama3.2-3b-instruct`
        };
      }
      return {
        type: 'error',
        message: 'Usage: /download [model-name]\nExample: /download llama3.2-3b-instruct'
      };
    }

    const manager = getLLMProviderManager();
    if (!manager || manager.getProviderType() !== 'inline-llm') {
      return {
        type: 'error',
        message: 'Model downloading is only available for Inline LLM provider. Switch with: /provider inline-llm'
      };
    }

    try {
      const result = await manager.pullModel(args);

      if (result.needsManualDownload) {
        return {
          type: 'info',
          message: result.instructions
        };
      }

      return {
        type: 'success',
        message: result.success ?
          `Model downloaded successfully: ${args}` :
          `Model already exists: ${args}`
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to download model: ${error.message}`
      };
    }
  },

  async listAvailableModels() {
    const manager = getLLMProviderManager();
    const modelManager = manager?.getModelManager();

    if (!modelManager) {
      return {
        type: 'error',
        message: 'Model management only available for Inline LLM provider'
      };
    }

    const recommended = modelManager.getRecommendedModels();
    const local = modelManager.listLocalModels();

    let message = 'Recommended models for download:\n';
    recommended.forEach(model => {
      const isLocal = local.some(l => l.name === model.filename);
      const status = isLocal ? '[DOWNLOADED]' : '[AVAILABLE]';
      message += `  ${status} ${model.name}: ${model.displayName} (${model.size})\n    ${model.description}\n\n`;
    });

    if (local.length > 0) {
      message += `\nLocal models (${local.length}):\n`;
      local.forEach(model => {
        message += `  - ${model.name} (${model.size})\n`;
      });
    }

    return {
      type: 'info',
      message: message
    };
  },

  async getModelInfo() {
    const manager = getLLMProviderManager();
    if (!manager) {
      return { type: 'error', message: 'LLM provider manager not initialized' };
    }

    const providerType = manager.getProviderType();
    const modelName = manager.getModelName();

    let message = `Current provider: ${providerType}\nModel: ${modelName}\n`;

    if (providerType === 'inline-llm') {
      try {
        const modelInfo = await manager.getModelInfo();
        if (modelInfo.loaded) {
          message += `Status: Loaded\n`;
          message += `Context size: ${modelInfo.contextSize}\n`;
          message += `GPU accelerated: ${modelInfo.isGpuAccelerated ? 'Yes' : 'No'}\n`;
          if (modelInfo.modelPath) {
            message += `Path: ${modelInfo.modelPath}\n`;
          }
        } else {
          message += `Status: Not loaded\n`;
        }
      } catch (error) {
        message += `Status: Error - ${error.message}\n`;
      }
    }

    return {
      type: 'info',
      message: message
    };
  },

  async loadModel(args) {
    if (!args) {
      return {
        type: 'error',
        message: 'Usage: /load-model [model-name]\nExample: /load-model llama3.2-3b-instruct'
      };
    }

    const manager = getLLMProviderManager();
    if (!manager || manager.getProviderType() !== 'inline-llm') {
      return {
        type: 'error',
        message: 'Model loading is only available for Inline LLM provider'
      };
    }

    try {
      const result = await manager.loadModel(args);
      return {
        type: 'success',
        message: `Model loaded successfully: ${result.modelName}`,
        additionalMessage: `Path: ${result.modelPath}`
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to load model: ${error.message}`
      };
    }
  },

  async unloadModel() {
    const manager = getLLMProviderManager();
    if (!manager || manager.getProviderType() !== 'inline-llm') {
      return {
        type: 'error',
        message: 'Model unloading is only available for Inline LLM provider'
      };
    }

    try {
      await manager.unloadModel();
      return {
        type: 'success',
        message: 'Model unloaded successfully'
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to unload model: ${error.message}`
      };
    }
  }
};