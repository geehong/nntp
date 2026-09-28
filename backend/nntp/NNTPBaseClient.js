import net from 'net';
import tls from 'tls';
import { EventEmitter } from 'events';

/**
 * NNTP Base Client Engine
 * Handles low-level TCP/TLS socket connections, NNTP protocol line parsing,
 * authentication, automatic reconnection, and basic commands.
 */
export class NNTPBaseClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 119,
      useSSL: config.useSSL ?? false,
      username: config.username || '',
      password: config.password || '',
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
      ...config,
    };

    // Alternate / Backup Server config (Failover)
    this.alternateConfig = config.alternateConfig || null;

    // Internal State
    this.socket = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.currentGroup = null;
    this.groupSummary = null; // { name, count, low, high }
    this.capabilities = [];
    this.buffer = '';
    this.pendingCommand = null; // { command, resolve, reject, isMultiline, dataLines }
    this.reconnectAttempts = 0;
    this.usingAlternate = false;
  }

  /**
   * Helper logger for console diagnostic output
   */
  log(level, category, message, details = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [NNTP:${category.toUpperCase()}]`;
    const fullMsg = details ? `${prefix} ${message} - ${typeof details === 'object' ? JSON.stringify(details) : details}` : `${prefix} ${message}`;
    
    if (level === 'error') {
      console.error(fullMsg);
    } else if (level === 'warn') {
      console.warn(fullMsg);
    } else {
      console.log(fullMsg);
    }
    
    this.emit('log', { level, category, message, details, timestamp });
  }

  /**
   * Establish TCP / TLS Connection to NNTP Server
   */
  async connect(isAlternate = false) {
    if (this.isConnected && this.socket && !this.socket.destroyed) {
      if (this.usingAlternate === isAlternate) {
        this.log('info', 'CONNECT', 'Already connected to target socket server');
        return true;
      }
      await this.disconnect();
    }

    const activeConfig = isAlternate && this.alternateConfig ? this.alternateConfig : this.config;
    this.usingAlternate = isAlternate;
    this.log('info', 'CONNECT', `Connecting to ${activeConfig.host}:${activeConfig.port} (SSL: ${activeConfig.useSSL}, Alternate: ${isAlternate})...`);

    return new Promise((resolve, reject) => {
      const options = {
        host: activeConfig.host,
        port: activeConfig.port,
        timeout: activeConfig.timeout,
        rejectUnauthorized: false,
      };

      const handleConnect = async () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.log('info', 'CONNECT', `Socket connection established with ${activeConfig.host}:${activeConfig.port}`);
        this.emit('connected', { host: activeConfig.host, port: activeConfig.port, isAlternate });

        try {
          // Read initial server greeting (200 / 201)
          const greeting = await this.readInitialGreeting();
          this.log('info', 'GREETING', `Server Greeting: ${greeting.code} ${greeting.message}`);

          // Authenticate if credentials provided
          if (activeConfig.username) {
            this.log('info', 'AUTH', `Authenticating as user '${activeConfig.username}'...`);
            await this.authenticate(activeConfig.username, activeConfig.password);
          } else {
            this.isAuthenticated = true;
            this.log('info', 'AUTH', 'No username provided. Skipping authentication.');
          }

          // Re-select group if session was lost and reconnected
          if (this.currentGroup) {
            this.log('info', 'GROUP', `Re-selecting group '${this.currentGroup}' after reconnection...`);
            await this.selectGroup(this.currentGroup, true);
          }

          resolve(true);
        } catch (err) {
          this.log('error', 'CONNECT', `Connection initialization failed: ${err.message}`);
          this.disconnect();
          reject(err);
        }
      };

      if (activeConfig.useSSL) {
        this.socket = tls.connect(options, handleConnect);
      } else {
        this.socket = net.connect(options, handleConnect);
      }

      this.socket.setEncoding('binary');
      // Set idle timeout only for initial connection; during XOVER streaming, timeout is suspended
      this.socket.setTimeout(activeConfig.timeout || 60000);

      this.socket.on('data', (chunk) => {
        // Reset idle timeout whenever data arrives (keeps alive during large XOVER streams)
        this.socket.setTimeout(0); // disable while actively receiving
        this._handleData(chunk);
        // Re-arm a longer inactivity timeout after each chunk
        if (this.socket && !this.socket.destroyed) {
          this.socket.setTimeout(120000); // 2 min idle after last data
        }
      });
      this.socket.on('error', (err) => {
        this.log('error', 'SOCKET', `Socket Error: ${err.message}`);
        this._handleError(err, reject);
      });
      this.socket.on('close', () => {
        this.log('warn', 'SOCKET', 'Socket connection closed.');
        this._handleClose();
      });
      this.socket.on('timeout', () => {
        this.log('warn', 'TIMEOUT', `Socket idle timeout (no data). Connected: ${this.isConnected}`);
        if (!this.isConnected) {
          // Connection-phase timeout
          this.emit('timeout');
          this.disconnect();
          reject(new Error(`NNTP Socket Connection Timeout (${activeConfig.host}:${activeConfig.port})`));
        } else if (this.pendingCommand) {
          // Idle timeout while waiting for response
          this.log('error', 'TIMEOUT', `No response to command '${this.pendingCommand.command}' after timeout. Disconnecting.`);
          const cmdObj = this.pendingCommand;
          this.pendingCommand = null;
          cmdObj.reject(new Error(`NNTP command timeout: ${cmdObj.command}`));
          this.disconnect();
        } else {
          // Idle with no command; just log it
          this.log('info', 'TIMEOUT', 'Socket idle timeout with no pending command. Connection still alive.');
        }
      });
    });
  }

  /**
   * Disconnect socket and reset connection state
   */
  async disconnect() {
    this.log('info', 'DISCONNECT', 'Disconnecting NNTP socket...');
    this.isConnected = false;
    this.isAuthenticated = false;
    this.buffer = '';
    if (this.pendingCommand) {
      this.pendingCommand.reject(new Error('Connection closed'));
      this.pendingCommand = null;
    }
    if (this.socket) {
      try {
        if (!this.socket.destroyed) {
          this.socket.write('QUIT\r\n');
          this.socket.end();
          this.socket.destroy();
        }
      } catch (e) {
        // Ignore socket destroy errors
      }
      this.socket = null;
    }
    this.emit('disconnected');
    return true;
  }

  /**
   * Check connection status and auto-reconnect if dropped
   */
  async checkConnection(reSelectGroup = true) {
    if (this.isConnected && this.socket && !this.socket.destroyed) {
      return true;
    }
    this.log('warn', 'RECONNECT', 'Connection lost, attempting auto-reconnect...');
    return await this.connect(this.usingAlternate);
  }

  /**
   * Authenticate using AUTHINFO USER / PASS
   */
  async authenticate(username, password) {
    this.log('info', 'AUTH', `Sending AUTHINFO USER ${username}`);
    const userRes = await this.sendCommand(`AUTHINFO USER ${username}`);
    if (userRes.code === 381) {
      this.log('info', 'AUTH', 'Password required (381). Sending AUTHINFO PASS ***');
      const passRes = await this.sendCommand(`AUTHINFO PASS ${password}`);
      if (passRes.code !== 281) {
        const errMsg = `NNTP Authentication Failed: ${passRes.code} ${passRes.message}`;
        this.log('error', 'AUTH', errMsg);
        throw new Error(errMsg);
      }
    } else if (userRes.code !== 281) {
      const errMsg = `NNTP Auth User Failed: ${userRes.code} ${userRes.message}`;
      this.log('error', 'AUTH', errMsg);
      throw new Error(errMsg);
    }
    this.isAuthenticated = true;
    this.log('info', 'AUTH', `Successfully authenticated as ${username} (281)`);
    this.emit('authenticated', { username });
    return true;
  }

  /**
   * Select a Newsgroup (GROUP <groupName>)
   */
  async selectGroup(groupName, force = false) {
    await this.checkConnection(false);

    if (!force && this.currentGroup === groupName && this.groupSummary) {
      return this.groupSummary;
    }

    this.log('info', 'GROUP', `Selecting newsgroup '${groupName}'...`);
    const res = await this.sendCommand(`GROUP ${groupName}`);
    if (res.code !== 211) {
      const errMsg = `Failed to select group ${groupName}: ${res.code} ${res.message}`;
      this.log('error', 'GROUP', errMsg);
      throw new Error(errMsg);
    }

    // Response format: 211 count low high group
    const parts = res.message.trim().split(/\s+/);
    let count = 0, low = 0, high = 0;
    if (parts.length >= 3) {
      count = parseInt(parts[0], 10) || 0;
      low = parseInt(parts[1], 10) || 0;
      high = parseInt(parts[2], 10) || 0;
    }
    const realCount = (high >= low && low > 0) ? (high - low + 1) : count;

    this.currentGroup = groupName;
    this.groupSummary = {
      name: groupName,
      count: realCount,
      rawCount: count,
      low,
      high,
    };

    this.log('info', 'GROUP', `Group selected: ${groupName} (Count: ${realCount}, Range: #${low} ~ #${high})`);
    this.emit('groupSelected', this.groupSummary);
    return this.groupSummary;
  }

  /**
   * Core Method: Send NNTP Command and await response
   */
  sendCommand(cmd, isMultiline = false) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        this.log('error', 'COMMAND', `Socket not connected when sending: '${cmd}'`);
        return reject(new Error('Socket is not connected'));
      }

      if (this.pendingCommand) {
        this.log('warn', 'COMMAND', `Command collision. Pending '${this.pendingCommand.command}' when trying to send '${cmd}'`);
        return reject(new Error(`Command in progress. Cannot send '${cmd}'`));
      }

      const logCmd = cmd.startsWith('AUTHINFO PASS') ? 'AUTHINFO PASS ***' : cmd;
      this.log('info', 'COMMAND', `Sending: ${logCmd}`);

      this.pendingCommand = {
        command: cmd,
        resolve,
        reject,
        isMultiline,
        dataLines: [],
      };

      this.socket.write(`${cmd}\r\n`);
    });
  }

  /**
   * Read initial server 200/201 welcome line
   */
  readInitialGreeting() {
    return new Promise((resolve, reject) => {
      this.pendingCommand = {
        command: 'GREETING',
        resolve: (res) => resolve(res),
        reject,
        isMultiline: false,
        dataLines: [],
      };
    });
  }

  /**
   * Internal Socket Data Handler & CRLF Line Parser
   */
  _handleData(chunk) {
    this.buffer += chunk;

    while (true) {
      const lineEndIndex = this.buffer.indexOf('\r\n');
      if (lineEndIndex === -1) break;

      const line = this.buffer.substring(0, lineEndIndex);
      this.buffer = this.buffer.substring(lineEndIndex + 2);

      this._processLine(line);
    }
  }

  /**
   * Process parsed protocol response line
   */
  _processLine(line) {
    if (!this.pendingCommand) return;

    const { isMultiline } = this.pendingCommand;

    // If we have a status code already → we're in multiline body collection mode
    if (isMultiline && this.pendingCommand.statusCode) {
      // Terminator: a bare single dot
      if (line === '.') {
        const cmdObj = this.pendingCommand;
        this.pendingCommand = null;
        this.log('info', 'RESPONSE', `Multiline response complete: ${cmdObj.statusCode}, ${cmdObj.dataLines.length} lines`);
        cmdObj.resolve({
          code: cmdObj.statusCode,
          message: cmdObj.statusMessage,
          lines: cmdObj.dataLines,
        });
        return;
      }
      // Dot-unstuffing (leading .. → .)
      const unescapedLine = line.startsWith('..') ? line.substring(1) : line;
      this.pendingCommand.dataLines.push(unescapedLine);

      const count = this.pendingCommand.dataLines.length;
      if (count % 300 === 0) {
        this.emit('progress', { current: count, command: this.pendingCommand.command });
      }
      return;
    }

    // Initial status line (3-digit code)
    const match = line.match(/^(\d{3})\s*(.*)$/);
    if (match) {
      const code = parseInt(match[1], 10);
      const message = match[2];
      this.log('info', 'RESPONSE', `Server response: ${code} ${message}`);

      if (isMultiline && code >= 200 && code < 400) {
        // Start collecting multiline body
        this.pendingCommand.statusCode = code;
        this.pendingCommand.statusMessage = message;
        return;
      }

      // Single-line response (or error)
      const cmdObj = this.pendingCommand;
      this.pendingCommand = null;
      return cmdObj.resolve({ code, message });
    }
  }

  _handleError(err, rejectFunc) {
    this.emit('error', err);
    if (rejectFunc) {
      rejectFunc(err);
    } else if (this.pendingCommand) {
      const cmdObj = this.pendingCommand;
      this.pendingCommand = null;
      cmdObj.reject(err);
    }
  }

  _handleClose() {
    this.isConnected = false;
    this.isAuthenticated = false;
    if (this.pendingCommand) {
      const cmdObj = this.pendingCommand;
      this.pendingCommand = null;
      cmdObj.reject(new Error('Socket closed unexpectedly'));
    }
    this.emit('close');
  }
}

export default NNTPBaseClient;
