import { NNTPBaseClient } from './NNTPBaseClient.js';
import { decodeYenc } from './yencDecoder.js';
import zlib from 'zlib';

/**
 * NNTP Advanced Business Client
 * Extends NNTPBaseClient with XOVER, HDR, GZip Compression,
 * yEnc Decoding, and Alternate Server Failover capabilities.
 */
export class NNTPClient extends NNTPBaseClient {
  constructor(config = {}) {
    super(config);
    this.useCompression = config.useCompression ?? true;
    this.compressionEnabled = false;
  }

  /**
   * Connect and initialize capability checks & optional compression
   */
  async connect(isAlternate = false) {
    const connected = await super.connect(isAlternate);
    if (connected && this.useCompression) {
      await this.enableCompression().catch(() => {
        this.compressionEnabled = false;
      });
    }
    return connected;
  }

  /**
   * Try enabling XFEATURE COMPRESS GZIP if server supports it
   */
  async enableCompression() {
    try {
      const res = await this.sendCommand('XFEATURE COMPRESS GZIP');
      if (res.code === 290) {
        this.compressionEnabled = true;
        this.emit('log', 'Header GZip compression enabled');
        return true;
      }
    } catch (e) {
      this.compressionEnabled = false;
    }
    return false;
  }

  /**
   * Fetch Article Headers Overview (XOVER range)
   * With automatic Failover to Alternate Server if missing
   */
  async fetchXOver(range) {
    await this.checkConnection();
    this.log('info', 'XOVER', `Requesting article overview headers for range ${range}...`);

    try {
      const res = await this.sendCommand(`XOVER ${range}`, true);
      if (res.code !== 224 && res.code !== 211) {
        const errMsg = `XOVER failed with status ${res.code}: ${res.message}`;
        this.log('error', 'XOVER', errMsg);
        throw new Error(errMsg);
      }

      const headers = (res.lines || []).map((line) => this.parseXOverLine(line));
      this.log('info', 'XOVER', `Successfully fetched ${headers.length} article headers for range ${range}`);
      return { success: true, headers, server: this.usingAlternate ? 'alternate' : 'primary' };
    } catch (err) {
      this.log('error', 'XOVER', `Error fetching XOVER ${range}: ${err.message}`);
      // Failover to Alternate Server if configured
      if (!this.usingAlternate && this.alternateConfig) {
        this.log('warn', 'FAILOVER', `Primary server XOVER failed (${err.message}). Failing over to Alternate Server...`);
        await this.connect(true);
        return this.fetchXOver(range);
      }
      throw err;
    }
  }

  /**
   * Fetch all newsgroups (LIST command)
   */
  async fetchGroups() {
    await this.checkConnection();
    this.log('info', 'LIST', 'Requesting all newsgroups list from server...');
    try {
      const res = await this.sendCommand('LIST', true);
      if (res.code !== 215) {
        throw new Error(`LIST failed with status ${res.code}: ${res.message}`);
      }
      
      const groups = (res.lines || []).map(line => {
        // e.g. "alt.binaries.test 25442207766 8653371680 y"
        const parts = line.split(' ');
        return {
          name: parts[0] || '',
          high: parseInt(parts[1], 10) || 0,
          low: parseInt(parts[2], 10) || 0,
          status: parts[3] || 'y'
        };
      }).filter(g => g.name);

      this.log('info', 'LIST', `Successfully fetched ${groups.length} newsgroups`);
      return groups;
    } catch (err) {
      this.log('error', 'LIST', `Error fetching newsgroups: ${err.message}`);
      throw err;
    }
  }

  /**
   * Helper method for WebSocket bridge: fetch overview for start/end numbers
   */
  async fetchOverview(start, end) {
    const range = `${start}-${end}`;
    const result = await this.fetchXOver(range);
    return result.headers || [];
  }

  /**
   * Parse single XOVER tab-separated line into structured object
   */
  parseXOverLine(line) {
    const parts = line.split('\t');
    const id = parseInt(parts[0], 10) || 0;
    const subject = parts[1] || '';
    const poster = parts[2] || '';
    const date = parts[3] || '';
    const msgId = (parts[4] || '').replace(/^<|>$/g, '');
    const references = parts[5] || '';
    const bytes = parseInt(parts[6], 10) || 0;
    const lines = parseInt(parts[7], 10) || 0;

    return {
      id,
      subject,
      poster,
      date,
      msgId,
      references,
      bytes,
      lines,
    };
  }

  /**
   * Fetch Article Body by Message-ID or Article Number
   * Decodes yEnc automatically if present
   */
  async fetchBody(articleId, decode = true) {
    await this.checkConnection();
    const formattedId = String(articleId).startsWith('<') ? articleId : `<${articleId}>`;
    this.log('info', 'BODY', `Fetching article body for ${formattedId}...`);

    try {
      const res = await this.sendCommand(`BODY ${formattedId}`, true);
      if (res.code !== 222 && res.code !== 220) {
        const errMsg = `BODY command failed with code ${res.code}: ${res.message}`;
        this.log('error', 'BODY', errMsg);
        throw new Error(errMsg);
      }

      const rawBody = (res.lines || []).join('\r\n');
      this.log('info', 'BODY', `Received raw article body (${res.lines.length} lines, ${rawBody.length} bytes)`);
      
      if (decode && rawBody.includes('=ybegin')) {
        this.log('info', 'ENCODING', 'yEnc header detected in article body. Decoding yEnc stream...');
        const decoded = decodeYenc(rawBody);
        this.log('info', 'ENCODING', `yEnc Decoding complete: file='${decoded.filename}', size=${decoded.size} bytes, crcValid=${decoded.crcValid}`);
        return {
          success: true,
          isYenc: true,
          filename: decoded.filename,
          size: decoded.size,
          crcValid: decoded.crcValid,
          data: decoded.data,
          server: this.usingAlternate ? 'alternate' : 'primary',
        };
      }

      this.log('info', 'ENCODING', 'Plain text or non-yEnc article body processed.');
      return {
        success: true,
        isYenc: false,
        rawBody,
        server: this.usingAlternate ? 'alternate' : 'primary',
      };
    } catch (err) {
      this.log('error', 'BODY', `Error fetching body for ${articleId}: ${err.message}`);
      if (!this.usingAlternate && this.alternateConfig) {
        this.log('warn', 'FAILOVER', `Primary server BODY failed for ${articleId}. Failing over to Alternate Server...`);
        await this.connect(true);
        return this.fetchBody(articleId, decode);
      }
      throw err;
    }
  }
}

export default NNTPClient;
