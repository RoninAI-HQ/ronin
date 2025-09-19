export class ToolResultFormatter {
  static formatResult(toolName, toolInput, result) {
    if (result.error || result.isError) {
      return this.formatError(toolName, result);
    }

    switch (toolName) {
      case 'file_list':
        return this.formatFileList(result, toolInput);
      case 'file_read':
        return this.formatFileRead(result, toolInput);
      case 'file_write':
        return this.formatFileWrite(result, toolInput);
      case 'shell_execute':
        return this.formatShellExecute(result, toolInput);
      case 'web_request':
        return this.formatWebRequest(result, toolInput);
      default:
        return this.formatGeneric(result, toolInput);
    }
  }

  static formatError(toolName, result) {
    const errorMsg = result.error || result.message || 'Unknown error';
    return `Error executing ${toolName}: ${errorMsg}`;
  }

  static formatFileList(result, input) {
    if (!result.files || !Array.isArray(result.files)) {
      return this.formatGeneric(result, input);
    }

    const path = result.path || input.path || 'current directory';
    const totalItems = result.count || result.files.length;
    const directories = result.files.filter(f => f.type === 'directory').length;
    const files = result.files.filter(f => f.type === 'file').length;

    if (totalItems === 0) {
      return `Listed ${path} (empty directory)`;
    }

    let summary = `Listed ${path} (${totalItems} items`;
    if (directories > 0 && files > 0) {
      summary += `: ${directories} dirs, ${files} files`;
    } else if (directories > 0) {
      summary += `: ${directories} directories`;
    } else if (files > 0) {
      summary += `: ${files} files`;
    }
    summary += ')';

    return summary;
  }

  static formatFileRead(result, input) {
    const path = result.path || input.path || 'unknown file';
    const content = result.content || '';

    if (content.length === 0) {
      return `Read ${path} (empty file)`;
    }

    const sizeDesc = content.length > 1000 ? `${Math.round(content.length/1000)}k chars` : `${content.length} chars`;
    return `Read ${path} (${sizeDesc})`;
  }

  static formatFileWrite(result, input) {
    const path = result.path || input.path || 'unknown file';
    const bytesWritten = result.bytesWritten || input.content?.length || 0;

    const sizeDesc = bytesWritten > 1000 ? `${Math.round(bytesWritten/1000)}k bytes` : `${bytesWritten} bytes`;
    return `Wrote ${path} (${sizeDesc})`;
  }

  static formatShellExecute(result, input) {
    const command = result.command || input.command || 'unknown command';
    const exitCode = result.exitCode !== undefined ? result.exitCode : '?';

    // Get just the command name (first word) for brevity
    const commandName = command.split(' ')[0];

    if (exitCode === 0) {
      return `Executed ${commandName} (exit code: ${exitCode})`;
    } else {
      return `Executed ${commandName} (exit code: ${exitCode})`;
    }
  }

  static formatWebRequest(result, input) {
    const url = input.url || 'unknown URL';
    const method = (input.method || 'GET').toUpperCase();
    const status = result.status || '?';

    // Extract domain from URL for brevity
    let domain;
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url.length > 30 ? url.substring(0, 30) + '...' : url;
    }

    return `${method} ${domain} (${status})`;
  }

  static formatGeneric(result, input) {
    return `Tool executed successfully`;
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