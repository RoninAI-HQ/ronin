#!/bin/bash

# Start Ollama server with suppressed output
echo "Starting Ollama server quietly..."

# Check if Ollama is already running
if pgrep -x "ollama" > /dev/null; then
    echo "Ollama is already running"
else
    # Start Ollama with output suppressed
    # Keep only errors, suppress INFO and model loading messages
    ollama serve 2>&1 | grep -v "INFO\|llama_model\|print_info\|load_tensors\|ggml_metal\|GIN\|time=" &

    # Wait a moment for server to start
    sleep 2

    # Check if it started successfully
    if curl -s http://localhost:11434/api/version > /dev/null; then
        echo "Ollama server started successfully"
    else
        echo "Failed to start Ollama server"
        exit 1
    fi
fi