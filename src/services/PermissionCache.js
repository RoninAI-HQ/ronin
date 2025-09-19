import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export class PermissionCache {
  constructor() {
    const homeDir = os.homedir();
    const roninDir = path.join(homeDir, '.ronin');

    // Ensure .ronin directory exists
    if (!fs.existsSync(roninDir)) {
      fs.mkdirSync(roninDir, { recursive: true });
    }

    this.cacheFile = path.join(roninDir, 'permissions.cache');
    this.cache = this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading permission cache:', error.message);
    }
    return {
      approvedTools: {},
      session: {
        startTime: new Date().toISOString(),
        alwaysAsk: false
      }
    };
  }

  saveCache() {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error('Error saving permission cache:', error.message);
    }
  }

  generateKey(toolName, input) {
    // Create a unique key based on tool name and parameters
    const sortedInput = this.sortObject(input);
    const inputString = JSON.stringify(sortedInput);

    // For file operations, use the full path as part of the key
    if (toolName === 'file_write' && input.path) {
      return `${toolName}:${input.path}`;
    }

    // For shell commands, hash the command for security
    if (toolName === 'shell_execute' && input.command) {
      const hash = crypto.createHash('sha256').update(input.command).digest('hex').substring(0, 16);
      return `${toolName}:cmd:${hash}`;
    }

    // Generic key for other tools
    const hash = crypto.createHash('sha256').update(inputString).digest('hex').substring(0, 16);
    return `${toolName}:${hash}`;
  }

  sortObject(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }

    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObject(obj[key]);
    });
    return sorted;
  }

  isApproved(toolName, input) {
    // Check if always ask mode is enabled
    if (this.cache.session?.alwaysAsk) {
      return false;
    }

    const key = this.generateKey(toolName, input);
    const approval = this.cache.approvedTools[key];

    if (!approval) {
      return false;
    }

    // Check if approval has expired (24 hours by default)
    const expirationTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const approvalAge = Date.now() - new Date(approval.timestamp).getTime();

    if (approvalAge > expirationTime) {
      // Remove expired approval
      delete this.cache.approvedTools[key];
      this.saveCache();
      return false;
    }

    return true;
  }

  addApproval(toolName, input, rememberChoice = false) {
    if (!rememberChoice) {
      // Don't cache if user doesn't want to remember
      return;
    }

    const key = this.generateKey(toolName, input);

    this.cache.approvedTools[key] = {
      toolName,
      timestamp: new Date().toISOString(),
      // Store sanitized version of input for reference
      summary: this.createSummary(toolName, input)
    };

    this.saveCache();
  }

  createSummary(toolName, input) {
    if (toolName === 'shell_execute') {
      // Only store first part of command for reference
      const cmd = input.command || '';
      const parts = cmd.split(' ');
      return parts[0] + (parts.length > 1 ? '...' : '');
    }

    if (toolName === 'file_write') {
      return input.path || 'unknown file';
    }

    return 'generic tool call';
  }

  clearCache() {
    this.cache.approvedTools = {};
    this.saveCache();
  }

  setAlwaysAsk(enabled) {
    this.cache.session.alwaysAsk = enabled;
    this.saveCache();
  }

  getStats() {
    return {
      totalApprovals: Object.keys(this.cache.approvedTools).length,
      alwaysAsk: this.cache.session?.alwaysAsk || false,
      sessionStart: this.cache.session?.startTime
    };
  }
}