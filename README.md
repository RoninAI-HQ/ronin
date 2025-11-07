# Ronin CLI

A command-line interface for interacting with AI language models. Supports both Anthropic's Claude API and local LLMs via Ollama. Features both interactive chat mode and one-shot queries.

## Prerequisites

*   Node.js (v18+ recommended)
*   For Claude: An Anthropic API Key
*   For Local LLMs: Ollama installed and running

## Setup

1.  Clone this repository (or download the files).
2.  Create a `.env` file in the project root directory and add your configuration:
    ```bash
    # For Anthropic Claude (default)
    ANTHROPIC_API_KEY=YOUR_ACTUAL_API_KEY

    # For Local LLMs (optional)
    LLM_PROVIDER=inline-llm  # Options: anthropic, ollama, inline-llm

    # For Inline LLMs
    INLINE_MODEL_NAME=llama3.2-3b-instruct
    CONTEXT_SIZE=4096

    # For Ollama
    OLLAMA_MODEL=llama3.2:3b  # Choose your model
    OLLAMA_BASE_URL=http://localhost:11434  # Ollama server URL
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```

## Installation (Optional)

To use `ronin` as a global command:

```bash
npm install -g .
```

After global installation, you can use `ronin` from anywhere in your terminal.

## Usage

### Interactive Mode

Start an interactive chat session:

```bash
npm start
# or if installed globally:
ronin
```

This will start the chat interface in your terminal where you can have ongoing conversations with Claude.

### One-Shot Mode

Ask a single question and get an immediate response:

```bash
# Using npm:
node src/main.js "How many miles is it from Austin, TX to Pittsburgh, PA?"

# Using global installation:
ronin "How many miles is it from Austin, TX to Pittsburgh, PA?"
```

The response will be displayed and the application will exit automatically.

### Available Commands (Interactive Mode)

**Conversation Commands:**
- `/help` - Show available commands
- `/save` - Save conversation as Markdown
- `/export` - Export conversation as JSON
- `/load list` - List saved conversations
- `/load [file]` - Load a conversation
- `/new` - Start new conversation (saves current)
- `/clear` - Clear screen
- `/exit` or `/quit` - Exit the application

**LLM Provider Commands:**
- `/provider` - Show current LLM provider
- `/provider [name]` - Switch provider (anthropic or ollama)
- `/models` - List available local models (Ollama only)
- `/pull [model]` - Download a new model (Ollama only)

## Using Local LLMs

Ronin supports two approaches for running local LLMs:

### Option 1: Inline LLMs (Recommended)
Run models directly within Ronin using node-llama-cpp - no separate server required!

**Setup:**
1. Set provider in your `.env` file:
   ```bash
   LLM_PROVIDER=inline-llm
   INLINE_MODEL_NAME=llama3.2-3b-instruct
   ```

2. Switch to inline provider:
   ```
   /provider inline-llm
   ```

3. Download a model:
   ```
   /download llama3.2-3b-instruct
   ```

**Commands:**
- `/models-available` - See downloadable models
- `/download [model]` - Download a model
- `/models` - List your local models
- `/load-model [name]` - Load a specific model
- `/unload-model` - Unload current model
- `/model-info` - Show model status

### Option 2: Ollama (External Server)

**Installing Ollama:**
1. **macOS/Linux:**
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Windows:** Download from [ollama.ai](https://ollama.ai)

**Running Ollama:**
1. Start the Ollama server:
   ```bash
   ollama serve
   ```

2. Pull a model (e.g., Llama 3.2):
   ```bash
   ollama pull llama3.2:3b
   ```

3. Configure Ronin to use Ollama:
   - Set `LLM_PROVIDER=ollama` in your `.env` file
   - Or switch providers at runtime: `/provider ollama`

### Recommended Local Models

**For Inline LLMs:**
- **llama3.2-3b-instruct** - Best balance of quality and speed
- **llama3.2-1b-instruct** - Fastest, minimal memory usage
- **mistral-7b-instruct** - Excellent for coding tasks
- **codellama-7b-instruct** - Specialized for code

**For Ollama:**
- **llama3.2:3b** - Best for general use, runs on most hardware
- **llama3.2:1b** - Fastest, minimal resource usage
- **mistral:7b** - Good coding abilities
- **codellama:7b** - Specialized for code

### Configuration Options

You can configure the local LLM using environment variables or a `llm.json` file:

**Environment Variables (.env):**
```bash
# For Inline LLMs
LLM_PROVIDER=inline-llm
INLINE_MODEL_NAME=llama3.2-3b-instruct
CONTEXT_SIZE=4096
MAX_TOKENS=2048
TEMPERATURE=0.7

# For Ollama
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://localhost:11434
```

**Configuration File (llm.json):**
```json
{
  "provider": "inline-llm",
  "inlineModelName": "llama3.2-3b-instruct",
  "contextSize": 4096,
  "maxTokens": 2048,
  "temperature": 0.7
}
```

**Or for Ollama:**
```json
{
  "provider": "ollama",
  "ollamaModel": "llama3.2:3b",
  "ollamaBaseUrl": "http://localhost:11434",
  "maxTokens": 2048,
  "temperature": 0.7
}
``` 