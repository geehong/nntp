/**
 * NZB XML Parser & Segment Assembler Utility
 */

/**
 * Parse NZB XML string into structured file items with segment Message-IDs
 */
export function parseNZBXml(nzbXmlContent) {
  if (!nzbXmlContent || typeof nzbXmlContent !== 'string') {
    throw new Error('Invalid NZB content');
  }

  const files = [];
  const fileRegex = /<file\s+poster="([^"]*)"\s+date="([^"]*)"\s+subject="([^"]*)">([\s\S]*?)<\/file>/gi;
  let fileMatch;

  while ((fileMatch = fileRegex.exec(nzbXmlContent)) !== null) {
    const poster = fileMatch[1];
    const date = parseInt(fileMatch[2], 10) || 0;
    const subject = fileMatch[3];
    const fileBody = fileMatch[4];

    // Extract Groups
    const groups = [];
    const groupRegex = /<group>([^<]+)<\/group>/gi;
    let groupMatch;
    while ((groupMatch = groupRegex.exec(fileBody)) !== null) {
      groups.push(groupMatch[1]);
    }

    // Extract Segments
    const segments = [];
    const segmentRegex = /<segment\s+bytes="(\d+)"\s+number="(\d+)">([^<]+)<\/segment>/gi;
    let segMatch;
    while ((segMatch = segmentRegex.exec(fileBody)) !== null) {
      segments.push({
        bytes: parseInt(segMatch[1], 10) || 0,
        number: parseInt(segMatch[2], 10) || 0,
        msgId: segMatch[3].trim().replace(/^<|>$/g, ''),
      });
    }

    // Sort segments by part number
    segments.sort((a, b) => a.number - b.number);

    files.push({
      subject,
      poster,
      date: date ? new Date(date * 1000).toISOString() : null,
      groups,
      segments,
      totalBytes: segments.reduce((sum, s) => sum + s.bytes, 0),
      totalSegments: segments.length,
    });
  }

  return {
    success: true,
    filesCount: files.length,
    files,
  };
}

/**
 * Assemble multiple decoded binary buffer segments into a single file
 */
export function assembleSegments(decodedBuffers = []) {
  if (!Array.isArray(decodedBuffers) || decodedBuffers.length === 0) {
    return Buffer.alloc(0);
  }
  return Buffer.concat(decodedBuffers);
}

export default { parseNZBXml, assembleSegments };
