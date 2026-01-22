import { EventEmitter } from 'events';
import { BuiltInServer } from '../mcp/BuiltInServer.js';
import { MCPClient } from '../mcp/MCPClient.js';

export class MCPManager extends EventEmitter {
  constructor(configService) {
    super();
    this.configService = configService;
    this.servers = new Map();
    this.tools = new Map();
    this.serverStatus = new Map(); // Track connection status and errors
    this.disabledServers = new Set(); // Track manually disabled servers
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this.getInitializationResult();

    const mcpConfig = this.configService.getMCPConfig();
    if (!mcpConfig || !mcpConfig.servers) {
      this.initialized = true;
      return { success: 0, failed: 0, errors: [] };
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const [name, config] of Object.entries(mcpConfig.servers)) {
      // Skip disabled servers
      if (this.disabledServers.has(name) || config.enabled === false) {
        this.serverStatus.set(name, {
          connected: false,
          disabled: true,
          error: null
        });
        continue;
      }

      try {
        await this.connectServer(name, config);
        results.success++;
        this.serverStatus.set(name, {
          connected: true,
          disabled: false,
          error: null,
          connectedAt: new Date()
        });
      } catch (error) {
        results.failed++;
        results.errors.push({
          server: name,
          error: error.message,
          config: config
        });
        this.serverStatus.set(name, {
          connected: false,
          disabled: false,
          error: error.message,
          failedAt: new Date()
        });
        this.emit('server:connection-failed', { name, error });
      }
    }

    this.initialized = true;
    return results;
  }

  getInitializationResult() {
    const success = Array.from(this.serverStatus.values()).filter(s => s.connected).length;
    const failed = Array.from(this.serverStatus.values()).filter(s => !s.connected && !s.disabled).length;
    const errors = [];

    for (const [name, status] of this.serverStatus.entries()) {
      if (!status.connected && !status.disabled && status.error) {
        errors.push({
          server: name,
          error: status.error
        });
      }
    }

    return { success, failed, errors };
  }

  async connectServer(name, config) {
    if (this.servers.has(name)) {
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

    this.emit('server:connected', { name, tools });
  }

  async disconnectServer(name) {
    const server = this.servers.get(name);
    if (!server) {
      throw new Error(`Server '${name}' not found`);
    }

    const toolCount = Array.from(this.tools.values()).filter(t => t.server === name).length;

    try {
      await server.disconnect();
    } catch (error) {
      // Log error but continue cleanup
      this.emit('server:disconnect-error', { name, error });
    }

    for (const [toolName, tool] of this.tools.entries()) {
      if (tool.server === name) {
        this.tools.delete(toolName);
      }
    }

    this.servers.delete(name);
    this.serverStatus.delete(name);
    this.emit('server:disconnected', { name, toolCount });

    return { toolCount };
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
        this.emit('server:shutdown-error', { name, error });
      }
    }
    this.servers.clear();
    this.tools.clear();
    this.serverStatus.clear();
    this.initialized = false;
  }

  /**
   * Get detailed information about a server
   * @param {string} name - Server name
   * @returns {object|null} Server information
   */
  getServerInfo(name) {
    const server = this.servers.get(name);
    const status = this.serverStatus.get(name);

    if (!server && !status) {
      return null;
    }

    const tools = Array.from(this.tools.values()).filter(t => t.server === name);
    const mcpConfig = this.configService.getMCPConfig();
    const config = mcpConfig?.servers?.[name];

    return {
      name,
      connected: !!server,
      disabled: status?.disabled || false,
      error: status?.error || null,
      connectedAt: status?.connectedAt || null,
      failedAt: status?.failedAt || null,
      toolCount: tools.length,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description
      })),
      config: config || null,
      transport: config?.transport || 'stdio'
    };
  }

  /**
   * Get status of all servers
   * @returns {Array} Array of server statuses
   */
  getAllServerInfo() {
    const mcpConfig = this.configService.getMCPConfig();
    const allServers = mcpConfig?.servers ? Object.keys(mcpConfig.servers) : [];

    return allServers.map(name => this.getServerInfo(name)).filter(Boolean);
  }

  /**
   * Enable a disabled server
   * @param {string} name - Server name
   */
  enableServer(name) {
    this.disabledServers.delete(name);
    const status = this.serverStatus.get(name);
    if (status) {
      status.disabled = false;
    }
  }

  /**
   * Disable a server
   * @param {string} name - Server name
   */
  async disableServer(name) {
    this.disabledServers.add(name);

    // Disconnect if currently connected
    if (this.servers.has(name)) {
      await this.disconnectServer(name);
    }

    const status = this.serverStatus.get(name);
    if (status) {
      status.disabled = true;
    } else {
      this.serverStatus.set(name, {
        connected: false,
        disabled: true,
        error: null
      });
    }
  }

  /**
   * Test connection to a server
   * @param {string} name - Server name
   * @param {object} config - Server configuration
   * @returns {Promise<object>} Test result
   */
  async testServerConnection(name, config) {
    try {
      let testServer;

      if (name === 'builtin') {
        testServer = new BuiltInServer(config);
        await testServer.initialize();
      } else if (config.command || config.url) {
        testServer = new MCPClient(name, config);
        await testServer.connect();
      } else {
        throw new Error('Invalid server configuration');
      }

      const tools = await testServer.listTools();

      // Disconnect test server
      await testServer.disconnect();

      return {
        success: true,
        toolCount: tools.length,
        tools: tools.map(t => ({ name: t.name, description: t.description }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}