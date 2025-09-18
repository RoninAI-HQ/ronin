import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

export class BuiltInServer {
  constructor(config) {
    this.config = config;
    this.tools = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    const enabledTools = this.config.tools || ['file_read', 'file_write', 'shell_execute', 'web_request'];

    if (enabledTools.includes('file_read')) {
      this.tools.set('file_read', {
        name: 'file_read',
        description: 'Read contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        },
        handler: this.fileRead.bind(this)
      });
    }

    if (enabledTools.includes('file_write')) {
      this.tools.set('file_write', {
        name: 'file_write',
        description: 'Write contents to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to write'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        },
        handler: this.fileWrite.bind(this)
      });
    }

    if (enabledTools.includes('file_list')) {
      this.tools.set('file_list', {
        name: 'file_list',
        description: 'List files in a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory'
            }
          },
          required: ['path']
        },
        handler: this.fileList.bind(this)
      });
    }

    if (enabledTools.includes('shell_execute')) {
      this.tools.set('shell_execute', {
        name: 'shell_execute',
        description: 'Execute a shell command',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Shell command to execute'
            },
            cwd: {
              type: 'string',
              description: 'Working directory for the command (optional)'
            }
          },
          required: ['command']
        },
        handler: this.shellExecute.bind(this)
      });
    }

    if (enabledTools.includes('web_request')) {
      this.tools.set('web_request', {
        name: 'web_request',
        description: 'Make an HTTP request',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to request'
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE'],
              description: 'HTTP method',
              default: 'GET'
            },
            headers: {
              type: 'object',
              description: 'Request headers (optional)'
            },
            data: {
              type: 'object',
              description: 'Request body data (optional)'
            }
          },
          required: ['url']
        },
        handler: this.webRequest.bind(this)
      });
    }

    this.initialized = true;
  }

  async listTools() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  async executeTool(toolName, args) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    try {
      return await tool.handler(args);
    } catch (error) {
      return {
        error: error.message,
        isError: true
      };
    }
  }

  async fileRead(args) {
    const filePath = path.resolve(args.path);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return {
        content,
        path: filePath
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  async fileWrite(args) {
    const filePath = path.resolve(args.path);
    try {
      await fs.writeFile(filePath, args.content, 'utf-8');
      return {
        success: true,
        path: filePath,
        bytesWritten: Buffer.byteLength(args.content, 'utf-8')
      };
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  async fileList(args) {
    const dirPath = path.resolve(args.path);
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, entry.name)
      }));
      return {
        files,
        count: files.length,
        path: dirPath
      };
    } catch (error) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  async shellExecute(args) {
    const options = {};
    if (args.cwd) {
      options.cwd = path.resolve(args.cwd);
    }

    try {
      const { stdout, stderr } = await execAsync(args.command, options);
      return {
        stdout,
        stderr,
        command: args.command,
        exitCode: 0
      };
    } catch (error) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        command: args.command,
        exitCode: error.code || 1,
        error: error.message
      };
    }
  }

  async webRequest(args) {
    try {
      const config = {
        url: args.url,
        method: args.method || 'GET',
        headers: args.headers || {},
        data: args.data
      };

      const response = await axios(config);

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      };
    } catch (error) {
      if (error.response) {
        return {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data,
          error: true
        };
      }
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  async disconnect() {
    this.initialized = false;
    this.tools.clear();
  }
}