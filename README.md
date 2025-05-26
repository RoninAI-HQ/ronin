# Ronin CLI

A command-line interface for interacting with Anthropic's Claude API. Supports both interactive chat mode and one-shot queries.

## Prerequisites

*   Node.js (v18+ recommended)
*   An Anthropic API Key

## Setup

1.  Clone this repository (or download the files).
2.  Create a `.env` file in the project root directory and add your Anthropic API key:
    ```
    ANTHROPIC_API_KEY=YOUR_ACTUAL_API_KEY
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

- `/help` - Show available commands
- `/save` - Save conversation as Markdown
- `/export` - Export conversation as JSON
- `/load list` - List saved conversations
- `/load [file]` - Load a conversation
- `/new` - Start new conversation (saves current)
- `/clear` - Clear screen
- `/exit` or `/quit` - Exit the application 