# MCP (Model Context Protocol) Integration Guide

## Overview

Ronin supports the Model Context Protocol (MCP), allowing Claude to interact with external tools and services through MCP servers. This feature enables extending Claude's capabilities with custom tools, file systems, APIs, and more.

## Configuration

MCP servers are configured in the `mcp.json` file. Copy `mcp.example.json` to get started:

```bash
cp mcp.example.json mcp.json
```

## Transport Protocols

Ronin supports three transport protocols for MCP servers:

### 1. Stdio Transport (Default)

For servers that communicate via standard input/output:

```json
{
  "servers": {
    "my-stdio-server": {
      "command": "node",
      "args": ["./my-mcp-server.js"],
      "transport": "stdio",
      "cwd": "/path/to/server",
      "env": {
        "API_KEY": "${MY_API_KEY}"
      }
    }
  }
}
```

**Options:**
- `command`: Executable to run
- `args`: Command arguments
- `cwd`: Working directory (optional)
- `env`: Environment variables with `${VAR}` expansion (optional)

### 2. SSE (Server-Sent Events) Transport

For HTTP-based servers using Server-Sent Events:

```json
{
  "servers": {
    "my-sse-server": {
      "transport": "sse",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}",
        "X-Custom-Header": "value"
      }
    }
  }
}
```

**Options:**
- `url`: Server endpoint URL
- `headers`: HTTP headers with `${VAR}` expansion (optional)
- `authProvider`: OAuth configuration (optional)
- `requestInit`: Custom fetch options (optional)

### 3. WebSocket Transport

For real-time bidirectional communication:

```json
{
  "servers": {
    "my-websocket-server": {
      "transport": "websocket",
      "url": "ws://localhost:8080/mcp"
    }
  }
}
```

**Options:**
- `url`: WebSocket server URL (ws:// or wss://)

## Built-in Server

Ronin includes a built-in MCP server with common tools:

```json
{
  "servers": {
    "builtin": {
      "enabled": true,
      "tools": ["file_read", "file_write", "file_list", "shell_execute", "web_request"]
    }
  }
}
```

Available built-in tools:
- `file_read`: Read file contents
- `file_write`: Write to files
- `file_list`: List directory contents
- `shell_execute`: Run shell commands
- `web_request`: Make HTTP requests

## Example Configurations

### GitHub MCP Server

Using Docker (recommended):

```json
{
  "servers": {
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "transport": "stdio",
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

Or using npx:

```json
{
  "servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "transport": "stdio",
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Filesystem MCP Server

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"],
      "transport": "stdio"
    }
  }
}
```

### Custom Python Server

```json
{
  "servers": {
    "python-tools": {
      "command": "python",
      "args": ["/path/to/mcp_server.py"],
      "transport": "stdio"
    }
  }
}
```

### Remote API Server via SSE

```json
{
  "servers": {
    "api-gateway": {
      "transport": "sse",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  }
}
```

## Environment Variables

Use `${VARIABLE_NAME}` syntax in configuration to reference environment variables:

```json
{
  "env": {
    "API_KEY": "${MY_SECRET_KEY}",
    "DATABASE_URL": "${DB_CONNECTION_STRING}"
  }
}
```

## Usage

1. Configure your MCP servers in `mcp.json`
2. Start Ronin - servers will connect automatically
3. Claude will have access to all tools from connected servers
4. Tool executions require user confirmation for safety

## Managing MCP Servers

Ronin provides interactive commands to manage MCP servers without manually editing configuration files.

### List Servers

View all configured servers with their status and available tools:

```bash
/mcp list
```

Shows:
- Server connection status (✓ Connected, ✗ Failed, ⊘ Disabled)
- Number of tools available per server
- Brief description of each tool

### View Server Details

Get detailed information about a specific server:

```bash
/mcp info <server-name>
```

Displays:
- Connection status and timestamp
- Transport type
- Configuration details
- Complete list of available tools
- Error messages (if connection failed)

### Add New Server

Interactively add a new MCP server:

```bash
/mcp add
```

The wizard will guide you through:
1. Choosing a unique server name
2. Selecting transport type (stdio, SSE, or WebSocket)
3. Providing required configuration (command, URL, etc.)
4. Setting environment variables
5. Testing the connection
6. Saving to mcp.json

### Edit Existing Server

Modify an existing server's configuration:

```bash
/mcp edit <server-name>
```

Uses the same interactive wizard as `/mcp add`, with current values pre-filled.

### Remove Server

Delete a server from configuration (with confirmation):

```bash
/mcp remove <server-name>
```

Prompts for confirmation before removing the server and disconnecting all its tools.

### Test Connection

Test a server's connection without modifying the configuration:

```bash
/mcp test <server-name>
```

Useful for debugging connection issues or verifying configuration changes.

### Enable/Disable Servers

Temporarily disable a server without removing it:

```bash
/mcp disable <server-name>
```

Re-enable a disabled server:

```bash
/mcp enable <server-name>
```

Disabled servers remain in the configuration but won't connect automatically.

### Reload Configuration

Reload mcp.json from disk and reconnect servers:

```bash
/mcp reload
```

Shows:
- Which servers were added, removed, or modified
- Connection results for each server
- Any errors that occurred during reconnection

## Troubleshooting

- **Server fails to connect**: Check that the command/URL is correct and the server is accessible
- **Tools not appearing**: Verify the server implements the MCP protocol correctly
- **Environment variables not working**: Ensure variables are set before starting Ronin
- **SSE/WebSocket connection issues**: Check firewall settings and network connectivity

## Security Notes

- All tool executions require explicit user confirmation
- Environment variables are expanded at runtime
- Be cautious with shell_execute and similar powerful tools
- Use authentication tokens for remote servers