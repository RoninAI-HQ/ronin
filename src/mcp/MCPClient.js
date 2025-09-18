import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

export class MCPClient {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.client = null;
    this.transport = null;
    this.process = null;
    this.tools = new Map();
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;

    try {
      // Default to stdio transport if not specified
      const transport = this.config.transport || 'stdio';

      if (transport === 'stdio') {
        await this.connectStdio();
      } else {
        throw new Error(`Unsupported transport: ${transport}`);
      }

      // The client is already initialized when connected
      const capabilities = await this.client.listTools();
      if (capabilities && capabilities.tools) {
        for (const tool of capabilities.tools) {
          this.tools.set(tool.name, tool);
        }
      }

      this.connected = true;
    } catch (error) {
      throw error;
    }
  }

  async connectStdio() {
    const command = this.config.command;
    const args = this.config.args || [];
    const env = { ...process.env };

    if (this.config.env) {
      for (const [key, value] of Object.entries(this.config.env)) {
        const expandedValue = value.replace(/\$\{(\w+)\}/g, (match, envVar) => {
          return process.env[envVar] || match;
        });
        env[key] = expandedValue;
      }
    }

    this.process = spawn(command, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.cwd
    });

    this.process.on('error', (error) => {
      this.handleDisconnect();
    });

    this.process.on('exit', (code, signal) => {
      this.handleDisconnect();
    });

    this.process.stderr.on('data', (data) => {
      // Ignore stderr output
    });

    this.transport = new StdioClientTransport({
      command,
      args,
      env,
      stdio: this.process.stdio
    });

    this.client = new Client({
      name: `ronin-${this.name}`,
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
  }

  async listTools() {
    if (!this.connected) {
      throw new Error(`MCP client ${this.name} not connected`);
    }

    return Array.from(this.tools.values());
  }

  async executeTool(toolName, args) {
    if (!this.connected) {
      throw new Error(`MCP client ${this.name} not connected`);
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${this.name}`);
    }

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: args
      });

      if (result.isError) {
        throw new Error(result.content?.[0]?.text || 'Tool execution failed');
      }

      return result.content?.[0] || { text: 'No result' };
    } catch (error) {
      throw error;
    }
  }

  handleDisconnect() {
    this.connected = false;
    this.tools.clear();

    if (this.client) {
      this.client = null;
    }

    if (this.transport) {
      this.transport = null;
    }

    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }

  async disconnect() {
    if (!this.connected) return;

    try {
      if (this.client) {
        await this.client.close();
      }
    } catch (error) {
      // Error closing client
    }

    this.handleDisconnect();
  }
}