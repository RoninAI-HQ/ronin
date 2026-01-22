/**
 * Validation utilities for Ronin
 * Provides reusable validation functions with helpful error messages
 */

/**
 * Validate a URL string
 * @param {string} url - URL to validate
 * @param {object} options - Validation options
 * @param {boolean} options.requireProtocol - Require http(s):// or ws(s):// protocol
 * @param {string[]} options.allowedProtocols - Allowed protocols (e.g., ['http', 'https'])
 * @returns {{valid: boolean, error?: string, normalized?: string}}
 */
export function validateUrl(url, options = {}) {
  const {
    requireProtocol = true,
    allowedProtocols = ['http', 'https', 'ws', 'wss']
  } = options;

  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required and must be a string' };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  try {
    const urlObj = new URL(trimmed);

    // Check protocol
    const protocol = urlObj.protocol.slice(0, -1); // Remove trailing ':'
    if (!allowedProtocols.includes(protocol)) {
      return {
        valid: false,
        error: `Invalid protocol '${protocol}'. Allowed: ${allowedProtocols.join(', ')}`
      };
    }

    // Check for hostname
    if (!urlObj.hostname) {
      return { valid: false, error: 'URL must include a hostname' };
    }

    return { valid: true, normalized: urlObj.toString() };
  } catch (error) {
    if (requireProtocol) {
      return {
        valid: false,
        error: `Invalid URL format. Example: https://example.com/path`
      };
    }

    // Try adding default protocol
    try {
      const defaultProtocol = allowedProtocols.includes('https') ? 'https' : allowedProtocols[0];
      const urlObj = new URL(`${defaultProtocol}://${trimmed}`);
      return {
        valid: true,
        normalized: urlObj.toString(),
        warning: `Added ${defaultProtocol}:// protocol`
      };
    } catch {
      return {
        valid: false,
        error: `Invalid URL format. Example: https://example.com/path`
      };
    }
  }
}

/**
 * Validate JSON string
 * @param {string} jsonString - JSON string to validate
 * @param {object} options - Validation options
 * @param {boolean} options.allowEmpty - Allow empty string (returns empty object)
 * @returns {{valid: boolean, error?: string, parsed?: object}}
 */
export function validateJson(jsonString, options = {}) {
  const { allowEmpty = true } = options;

  if (!jsonString || typeof jsonString !== 'string') {
    if (allowEmpty && !jsonString) {
      return { valid: true, parsed: {} };
    }
    return { valid: false, error: 'JSON input is required' };
  }

  const trimmed = jsonString.trim();
  if (!trimmed) {
    if (allowEmpty) {
      return { valid: true, parsed: {} };
    }
    return { valid: false, error: 'JSON cannot be empty' };
  }

  try {
    const parsed = JSON.parse(trimmed);

    // Ensure it's an object, not a primitive
    if (typeof parsed !== 'object' || parsed === null) {
      return {
        valid: false,
        error: 'JSON must be an object, not a primitive value'
      };
    }

    return { valid: true, parsed };
  } catch (error) {
    // Try to provide helpful error message
    const errorMsg = error.message;
    let position = '';

    // Extract position from error message if available
    const posMatch = errorMsg.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      const snippet = trimmed.substring(Math.max(0, pos - 20), pos + 20);
      position = `\n  Near: ...${snippet}...`;
    }

    return {
      valid: false,
      error: `Invalid JSON: ${errorMsg}${position}\n  Example: {"key": "value"}`
    };
  }
}

/**
 * Validate server name
 * @param {string} name - Server name to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateServerName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Server name is required' };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Server name cannot be empty' };
  }

  // Check length
  if (trimmed.length < 2) {
    return { valid: false, error: 'Server name must be at least 2 characters' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Server name must be 50 characters or less' };
  }

  // Check for valid characters: alphanumeric, hyphens, underscores
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Server name can only contain letters, numbers, hyphens, and underscores'
    };
  }

  // Check it doesn't start or end with hyphen/underscore
  if (/^[-_]|[-_]$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Server name cannot start or end with hyphen or underscore'
    };
  }

  // Reserved names
  const reserved = ['builtin', 'localhost', 'default', 'system', 'config'];
  if (reserved.includes(trimmed.toLowerCase())) {
    return {
      valid: false,
      error: `Server name '${trimmed}' is reserved. Please choose a different name.`
    };
  }

  return { valid: true };
}

/**
 * Validate command/executable path
 * @param {string} command - Command to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateCommand(command) {
  if (!command || typeof command !== 'string') {
    return { valid: false, error: 'Command is required' };
  }

  const trimmed = command.trim();
  if (!trimmed) {
    return { valid: false, error: 'Command cannot be empty' };
  }

  // Check for common shells/interpreters that are usually safe
  const commonCommands = [
    'node', 'python', 'python3', 'ruby', 'npx', 'docker',
    'deno', 'bun', 'java', 'go', 'rust', 'cargo'
  ];

  const commandName = trimmed.split(/\s+/)[0];

  // Warn about potentially dangerous commands
  const dangerousCommands = ['rm', 'sudo', 'kill', 'shutdown', 'reboot'];
  if (dangerousCommands.includes(commandName)) {
    return {
      valid: false,
      error: `Command '${commandName}' is not allowed for security reasons`
    };
  }

  return { valid: true };
}

/**
 * Validate environment variables object
 * @param {object} env - Environment variables object
 * @returns {{valid: boolean, error?: string}}
 */
export function validateEnvVars(env) {
  if (!env) {
    return { valid: true }; // Optional
  }

  if (typeof env !== 'object' || Array.isArray(env)) {
    return { valid: false, error: 'Environment variables must be an object' };
  }

  // Check all keys are valid environment variable names
  for (const key of Object.keys(env)) {
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
      return {
        valid: false,
        error: `Invalid environment variable name: '${key}'. Must start with letter/underscore and contain only letters, numbers, and underscores.`
      };
    }

    // Check value is a string
    if (typeof env[key] !== 'string') {
      return {
        valid: false,
        error: `Environment variable '${key}' must have a string value`
      };
    }
  }

  return { valid: true };
}

/**
 * Validate transport type
 * @param {string} transport - Transport type to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateTransport(transport) {
  const validTransports = ['stdio', 'sse', 'websocket', 'ws'];

  if (!transport || typeof transport !== 'string') {
    return { valid: false, error: 'Transport type is required' };
  }

  const normalized = transport.toLowerCase().trim();
  if (!validTransports.includes(normalized)) {
    return {
      valid: false,
      error: `Invalid transport type. Must be one of: ${validTransports.join(', ')}`
    };
  }

  return { valid: true, normalized };
}

/**
 * Parse shell-style arguments (handles quoted strings with spaces)
 * @param {string} argsString - Arguments string to parse
 * @returns {string[]} Array of arguments
 */
export function parseShellArgs(argsString) {
  if (!argsString || !argsString.trim()) {
    return [];
  }

  const args = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    const nextChar = argsString[i + 1];

    if ((char === '"' || char === "'") && !inQuotes) {
      // Start quote
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      // End quote
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      // Space outside quotes - separator
      if (current) {
        args.push(current);
        current = '';
      }
    } else if (char === '\\' && nextChar && (nextChar === '"' || nextChar === "'")) {
      // Escaped quote
      current += nextChar;
      i++; // Skip next character
    } else {
      current += char;
    }
  }

  // Add last argument
  if (current) {
    args.push(current);
  }

  return args;
}
