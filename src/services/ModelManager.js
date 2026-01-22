import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';

export class ModelManager {
  constructor(config = {}) {
    this.modelsDir = config.modelsDir || path.join(os.homedir(), '.ronin', 'models');
    this.ensureModelsDirectory();
  }

  ensureModelsDirectory() {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
      // Created models directory
    }
  }

  // List of recommended models with download information
  getRecommendedModels() {
    return [
      {
        name: 'llama3.2-3b-instruct',
        displayName: 'Llama 3.2 3B Instruct',
        description: 'Fast and efficient, good for general use',
        size: '2.0GB',
        filename: 'Meta-Llama-3.2-3B-Instruct.Q4_K_M.gguf',
        huggingFaceRepo: 'bartowski/Meta-Llama-3.2-3B-Instruct-GGUF',
        recommended: true
      },
      {
        name: 'llama3.2-1b-instruct',
        displayName: 'Llama 3.2 1B Instruct',
        description: 'Very fast, minimal memory usage',
        size: '800MB',
        filename: 'Meta-Llama-3.2-1B-Instruct.Q4_K_M.gguf',
        huggingFaceRepo: 'bartowski/Meta-Llama-3.2-1B-Instruct-GGUF'
      },
      {
        name: 'mistral-7b-instruct',
        displayName: 'Mistral 7B Instruct',
        description: 'Excellent for coding and technical tasks',
        size: '4.1GB',
        filename: 'Mistral-7B-Instruct-v0.3.Q4_K_M.gguf',
        huggingFaceRepo: 'bartowski/Mistral-7B-Instruct-v0.3-GGUF'
      },
      {
        name: 'codellama-7b-instruct',
        displayName: 'CodeLlama 7B Instruct',
        description: 'Specialized for code generation and analysis',
        size: '4.1GB',
        filename: 'CodeLlama-7B-Instruct.Q4_K_M.gguf',
        huggingFaceRepo: 'bartowski/CodeLlama-7B-Instruct-GGUF'
      }
    ];
  }

  listLocalModels() {
    try {
      const files = fs.readdirSync(this.modelsDir);
      const modelFiles = files.filter(file =>
        file.endsWith('.gguf') || file.endsWith('.ggml')
      ).map(file => {
        const filePath = path.join(this.modelsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: this.formatFileSize(stats.size),
          sizeBytes: stats.size,
          modified: stats.mtime,
          isRecommended: this.isRecommendedModel(file)
        };
      });

      return modelFiles;
    } catch (error) {
      // Error listing models
      return [];
    }
  }

  isRecommendedModel(filename) {
    const recommended = this.getRecommendedModels();
    return recommended.some(model => model.filename === filename);
  }

  findModelByName(modelName) {
    const models = this.listLocalModels();

    // Try exact filename match first
    let found = models.find(model => model.name === modelName);
    if (found) return found;

    // Try partial name matching
    found = models.find(model =>
      model.name.toLowerCase().includes(modelName.toLowerCase()) ||
      modelName.toLowerCase().includes(model.name.toLowerCase().replace(/\\.gguf$/, ''))
    );
    if (found) return found;

    // Try matching against recommended model names
    const recommended = this.getRecommendedModels();
    const recommendedModel = recommended.find(r => r.name === modelName);
    if (recommendedModel) {
      found = models.find(model => model.name === recommendedModel.filename);
    }

    return found || null;
  }

  getModelPath(modelName) {
    const model = this.findModelByName(modelName);
    return model ? model.path : null;
  }

  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  async downloadModel(modelName, progressCallback = null) {
    const recommendedModels = this.getRecommendedModels();
    const modelInfo = recommendedModels.find(m => m.name === modelName);

    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelName}. Use /models-available to see recommended models.`);
    }

    const filePath = path.join(this.modelsDir, modelInfo.filename);

    // Check if model already exists
    if (fs.existsSync(filePath)) {
      return {
        success: true,
        message: `Model ${modelInfo.displayName} already exists`,
        path: filePath
      };
    }

    // For now, provide download instructions rather than automatic download
    // This avoids dealing with Hugging Face authentication and large file downloads
    const downloadUrl = `https://huggingface.co/${modelInfo.huggingFaceRepo}/resolve/main/${modelInfo.filename}`;

    const instructions = `
To download ${modelInfo.displayName}:

1. Manual download:
   wget "${downloadUrl}" -O "${filePath}"

2. Or using curl:
   curl -L "${downloadUrl}" -o "${filePath}"

3. Or visit: https://huggingface.co/${modelInfo.huggingFaceRepo}

The model will be saved to: ${filePath}
Size: ${modelInfo.size}
`;

    return {
      success: false,
      needsManualDownload: true,
      instructions: instructions,
      downloadUrl: downloadUrl,
      filePath: filePath
    };
  }

  deleteModel(modelName) {
    const model = this.findModelByName(modelName);
    if (!model) {
      throw new Error(`Model not found: ${modelName}`);
    }

    try {
      fs.unlinkSync(model.path);
      return {
        success: true,
        message: `Deleted model: ${model.name}`,
        freedSpace: model.size
      };
    } catch (error) {
      throw new Error(`Failed to delete model: ${error.message}`);
    }
  }

  getModelsDirectoryInfo() {
    const models = this.listLocalModels();
    const totalSize = models.reduce((sum, model) => sum + model.sizeBytes, 0);

    return {
      directory: this.modelsDir,
      modelCount: models.length,
      totalSize: this.formatFileSize(totalSize),
      totalSizeBytes: totalSize,
      models: models
    };
  }

  async suggestFirstTimeSetup() {
    const models = this.listLocalModels();

    if (models.length === 0) {
      const recommended = this.getRecommendedModels().find(m => m.recommended);
      return {
        hasModels: false,
        suggestion: `No models found. Consider downloading ${recommended.displayName} for the best experience.`,
        recommendedModel: recommended.name,
        instructions: `Run: /download ${recommended.name}`
      };
    }

    return {
      hasModels: true,
      modelCount: models.length,
      models: models.map(m => m.name)
    };
  }
}