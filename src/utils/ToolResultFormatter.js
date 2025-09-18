export class ToolResultFormatter {
  static formatResult(toolName, toolInput, result) {
    const header = `## 🔧 Tool: \`${toolName}\`\n`;

    if (result.error || result.isError) {
      return header + this.formatError(toolName, result);
    }

    switch (toolName) {
      case 'file_list':
        return header + this.formatFileList(result, toolInput);
      case 'file_read':
        return header + this.formatFileRead(result, toolInput);
      case 'file_write':
        return header + this.formatFileWrite(result, toolInput);
      case 'shell_execute':
        return header + this.formatShellExecute(result, toolInput);
      case 'web_request':
        return header + this.formatWebRequest(result, toolInput);
      default:
        return header + this.formatGeneric(result, toolInput);
    }
  }

  static formatError(toolName, result) {
    const errorMsg = result.error || result.message || 'Unknown error';
    return `❌ **Error**: ${errorMsg}\n\n`;
  }

  static formatFileList(result, input) {
    if (!result.files || !Array.isArray(result.files)) {
      return this.formatGeneric(result, input);
    }

    const path = result.path || input.path || 'Unknown path';
    let output = `📁 **Directory**: \`${path}\`\n`;
    output += `📊 **Total**: ${result.count || result.files.length} items\n\n`;

    if (result.files.length === 0) {
      output += '*Empty directory*\n\n';
      return output;
    }

    // Group by type
    const directories = result.files.filter(f => f.type === 'directory');
    const files = result.files.filter(f => f.type === 'file');

    if (directories.length > 0) {
      output += `### 📂 Directories (${directories.length})\n`;
      for (const dir of directories) {
        output += `- 📁 **${dir.name}**\n`;
      }
      output += '\n';
    }

    if (files.length > 0) {
      output += `### 📄 Files (${files.length})\n`;
      for (const file of files) {
        const ext = this.getFileExtension(file.name);
        const icon = this.getFileIcon(ext);
        output += `- ${icon} \`${file.name}\`\n`;
      }
      output += '\n';
    }

    return output;
  }

  static formatFileRead(result, input) {
    const path = result.path || input.path || 'Unknown file';
    const content = result.content || '';

    let output = `📖 **Reading**: \`${path}\`\n`;
    output += `📏 **Size**: ${content.length} characters\n\n`;

    if (content.length === 0) {
      output += '*File is empty*\n\n';
      return output;
    }

    // Detect file type and format accordingly
    const ext = this.getFileExtension(path);
    const language = this.getLanguageFromExtension(ext);

    if (content.length > 2000) {
      output += `### 📝 Content Preview (first 2000 characters)\n\n`;
      output += `\`\`\`${language}\n${content.substring(0, 2000)}...\n\`\`\`\n\n`;
      output += `*File truncated - showing first 2000 of ${content.length} characters*\n\n`;
    } else {
      output += `### 📝 File Content\n\n`;
      output += `\`\`\`${language}\n${content}\n\`\`\`\n\n`;
    }

    return output;
  }

  static formatFileWrite(result, input) {
    const path = result.path || input.path || 'Unknown file';
    const bytesWritten = result.bytesWritten || input.content?.length || 0;

    let output = `✍️ **Writing**: \`${path}\`\n`;
    output += `💾 **Bytes written**: ${bytesWritten}\n`;

    if (result.success) {
      output += `✅ **Status**: Successfully written\n\n`;
    } else {
      output += `⚠️ **Status**: Write completed (no confirmation)\n\n`;
    }

    return output;
  }

  static formatShellExecute(result, input) {
    const command = result.command || input.command || 'Unknown command';
    const exitCode = result.exitCode !== undefined ? result.exitCode : 'Unknown';

    let output = `⚡ **Command**: \`${command}\`\n`;
    output += `🔢 **Exit Code**: ${exitCode}\n`;

    if (result.cwd || input.cwd) {
      output += `📂 **Working Directory**: \`${result.cwd || input.cwd}\`\n`;
    }

    output += '\n';

    if (result.stdout && result.stdout.trim()) {
      output += `### 📤 Standard Output\n\`\`\`\n${result.stdout.trim()}\n\`\`\`\n\n`;
    }

    if (result.stderr && result.stderr.trim()) {
      output += `### ⚠️ Standard Error\n\`\`\`\n${result.stderr.trim()}\n\`\`\`\n\n`;
    }

    if (!result.stdout?.trim() && !result.stderr?.trim()) {
      output += `*No output*\n\n`;
    }

    return output;
  }

  static formatWebRequest(result, input) {
    const url = input.url || 'Unknown URL';
    const method = (input.method || 'GET').toUpperCase();
    const status = result.status || 'Unknown';

    let output = `🌐 **${method}**: \`${url}\`\n`;
    output += `📊 **Status**: ${status}`;

    if (result.statusText) {
      output += ` ${result.statusText}`;
    }

    output += '\n';

    // Show response headers if present
    if (result.headers && Object.keys(result.headers).length > 0) {
      output += `\n### 📋 Response Headers\n`;
      const importantHeaders = ['content-type', 'content-length', 'cache-control', 'last-modified'];
      for (const header of importantHeaders) {
        if (result.headers[header]) {
          output += `- **${header}**: \`${result.headers[header]}\`\n`;
        }
      }
      output += '\n';
    }

    // Format response data
    if (result.data !== undefined) {
      output += `### 📄 Response Data\n`;

      const contentType = result.headers?.['content-type'] || '';

      if (contentType.includes('application/json')) {
        output += `\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\`\n\n`;
      } else if (contentType.includes('text/html')) {
        const dataStr = typeof result.data === 'string' ? result.data : String(result.data);
        if (dataStr.length > 1000) {
          output += `\`\`\`html\n${dataStr.substring(0, 1000)}...\n\`\`\`\n`;
          output += `*Response truncated - showing first 1000 of ${dataStr.length} characters*\n\n`;
        } else {
          output += `\`\`\`html\n${dataStr}\n\`\`\`\n\n`;
        }
      } else if (contentType.includes('text/')) {
        const dataStr = typeof result.data === 'string' ? result.data : String(result.data);
        output += `\`\`\`\n${dataStr}\n\`\`\`\n\n`;
      } else {
        output += `\`\`\`\n${JSON.stringify(result.data, null, 2)}\n\`\`\`\n\n`;
      }
    }

    return output;
  }

  static formatGeneric(result, input) {
    let output = '';

    if (input && Object.keys(input).length > 0) {
      output += `### 📥 Input\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\`\n\n`;
    }

    output += `### 📤 Result\n`;

    if (typeof result === 'string') {
      output += `\`\`\`\n${result}\n\`\`\`\n\n`;
    } else if (result && typeof result === 'object') {
      output += `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\n`;
    } else {
      output += `\`${result}\`\n\n`;
    }

    return output;
  }

  static getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') return '';
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.substring(lastDot + 1).toLowerCase();
  }

  static getFileIcon(extension) {
    const iconMap = {
      // Programming languages
      'js': '🟨', 'ts': '🔷', 'jsx': '⚛️', 'tsx': '⚛️',
      'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
      'html': '🌐', 'css': '🎨', 'scss': '🎨', 'sass': '🎨',
      'json': '📋', 'xml': '📄', 'yaml': '📝', 'yml': '📝',
      'md': '📖', 'txt': '📄', 'log': '📊',
      'sh': '⚡', 'bash': '⚡', 'zsh': '⚡',
      // Images
      'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🎨',
      // Documents
      'pdf': '📕', 'doc': '📘', 'docx': '📘', 'xls': '📗', 'xlsx': '📗',
      // Archives
      'zip': '📦', 'tar': '📦', 'gz': '📦', 'rar': '📦',
      // Others
      'env': '🔧', 'config': '⚙️', 'lock': '🔒'
    };

    return iconMap[extension] || '📄';
  }

  static getLanguageFromExtension(extension) {
    const languageMap = {
      'js': 'javascript', 'ts': 'typescript', 'jsx': 'jsx', 'tsx': 'tsx',
      'py': 'python', 'java': 'java', 'cpp': 'cpp', 'c': 'c',
      'html': 'html', 'css': 'css', 'scss': 'scss', 'sass': 'sass',
      'json': 'json', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
      'md': 'markdown', 'sh': 'bash', 'bash': 'bash', 'zsh': 'zsh',
      'sql': 'sql', 'go': 'go', 'rs': 'rust', 'php': 'php',
      'rb': 'ruby', 'swift': 'swift', 'kt': 'kotlin', 'dart': 'dart'
    };

    return languageMap[extension] || '';
  }
}