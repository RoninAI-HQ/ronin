import { EventEmitter } from 'events';
import { BuiltInServer } from '../mcp/BuiltInServer.js';
import { MCPClient } from '../mcp/MCPClient.js';

export class MCPManager extends EventEmitter {
  constructor(configService) {
    super();
    this.configService = configService;
    this.servers = new Map();
    this.tools = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    const mcpConfig = this.configService.getMCPConfig();
    if (!mcpConfig || !mcpConfig.servers) {
      console.log('[MCP] No MCP servers configured');
      return;
    }

    for (const [name, config] of Object.entries(mcpConfig.servers)) {
      try {
        await this.connectServer(name, config);
      } catch (error) {
        console.error(`[MCP] Failed to connect to server ${name}:`, error.message);
      }
    }

    this.initialized = true;
  }

  async connectServer(name, config) {
    if (this.servers.has(name)) {
      console.log(`[MCP] Server ${name} already connected`);
      return;
    }

    let server;

    if (name === 'builtin' && config.enabled !== false) {
      server = new BuiltInServer(config);
      await server.initialize();
    } else if (config.command) {
      server = new MCPClient(name, config);
      await server.connect();
    } else {
      console.log(`[MCP] Skipping server ${name} - no command specified`);
      return;
    }

    this.servers.set(name, server);

    const tools = await server.listTools();
    for (const tool of tools) {
      this.tools.set(tool.name, {
        ...tool,
        server: name,
        handler: server
      });
    }

    console.log(`[MCP] Connected to ${name} with ${tools.length} tools`);
    this.emit('server:connected', { name, tools });
  }

  async disconnectServer(name) {
    const server = this.servers.get(name);
    if (!server) return;

    try {
      await server.disconnect();
    } catch (error) {
      console.error(`[MCP] Error disconnecting ${name}:`, error.message);
    }

    for (const [toolName, tool] of this.tools.entries()) {
      if (tool.server === name) {
        this.tools.delete(toolName);
      }
    }

    this.servers.delete(name);
    this.emit('server:disconnected', { name });
  }

  async executeTool(toolName, args) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    try {
      const result = await tool.handler.executeTool(toolName, args);
      this.emit('tool:executed', { toolName, args, result });
      return result;
    } catch (error) {
      this.emit('tool:error', { toolName, args, error });
      throw error;
    }
  }

  getAvailableTools() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      server: tool.server
    }));
  }

  getToolSchema(toolName) {
    const tool = this.tools.get(toolName);
    return tool ? tool.inputSchema : null;
  }

  hasTools() {
    return this.tools.size > 0;
  }

  getServers() {
    return Array.from(this.servers.keys());
  }

  async shutdown() {
    for (const [name, server] of this.servers.entries()) {
      try {
        await server.disconnect();
      } catch (error) {
        console.error(`[MCP] Error shutting down ${name}:`, error.message);
      }
    }
    this.servers.clear();
    this.tools.clear();
    this.initialized = false;
  }
}