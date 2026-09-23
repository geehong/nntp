function decodeYencLine(lineBuf, out) {
  for (let i = 0; i < lineBuf.length; i++) {
    let b = lineBuf[i];
    if (b === 0x3d) {
      i++;
      if (i >= lineBuf.length) break;
      b = lineBuf[i];
      out.push((b - 64 - 42) & 0xff);
    } else {
      out.push((b - 42) & 0xff);
    }
  }
}

function decodeYencArticle(rawBuf) {
  const CRLF = Buffer.from('\r\n');
  let start = 0;
  let filename = null;
  let inData = false;
  let part = 1;
  let begin = 0;
  let end = 0;
  let totalSize = 0;
  const outBytes = [];

  // console.log(`[Decode] Starting yEnc decode for buffer of size: ${rawBuf.length} bytes`);

  let isUuencode = false;
  let uuFilename = null;
  let lineCount = 0;
  const firstFewLines = [];

  while (start <= rawBuf.length) {
    const idx = rawBuf.indexOf(CRLF, start);
    const endIdx = idx === -1 ? rawBuf.length : idx;
    let line = rawBuf.subarray(start, endIdx);
    start = idx === -1 ? rawBuf.length + 1 : idx + 2;
    lineCount++;

    if (lineCount <= 10) {
      firstFewLines.push(line.toString('latin1').substring(0, 80));
    }

    if (line.length === 1 && line[0] === 0x2e) {
      break; // lone "."
    }
    if (line.length > 0 && line[0] === 0x2e) line = line.subarray(1); // dot-stuffing

    const asciiLine = line.toString('latin1');
    const asciiPrefix = asciiLine.substring(0, 8);
    
    // Check for UUEncode
    if (!inData && asciiLine.startsWith('begin ') && asciiLine.length > 9) {
      const parts = asciiLine.split(' ');
      if (parts.length >= 3) {
        isUuencode = true;
        inData = true;
        uuFilename = parts.slice(2).join(' ').trim();
        filename = uuFilename;
        continue;
      }
    }

    if (isUuencode && inData) {
      if (asciiLine === 'end' || asciiLine === '`') {
        break; // UUEncode end
      }
      // UUDecode line
      if (line.length > 0) {
        const lenChar = line[0];
        const decLen = (lenChar - 32) & 0x3f;
        if (decLen > 0 && line.length > 1) {
          let b = 0, idxOut = 0;
          for (let i = 1; i < line.length && idxOut < decLen; i += 4) {
            const c1 = (line[i] - 32) & 0x3f;
            const c2 = i + 1 < line.length ? (line[i + 1] - 32) & 0x3f : 0;
            const c3 = i + 2 < line.length ? (line[i + 2] - 32) & 0x3f : 0;
            const c4 = i + 3 < line.length ? (line[i + 3] - 32) & 0x3f : 0;
            
            if (idxOut++ < decLen) outBytes.push((c1 << 2) | (c2 >> 4));
            if (idxOut++ < decLen) outBytes.push(((c2 & 15) << 4) | (c3 >> 2));
            if (idxOut++ < decLen) outBytes.push(((c3 & 3) << 6) | c4);
          }
        }
      }
      continue;
    }

    if (asciiPrefix.startsWith('=ybegin')) {
      const mName = asciiLine.match(/\bname=(.+)$/);
      if (mName) filename = mName[1].trim();
      
      const mPart = asciiLine.match(/\bpart=(\d+)/);
      if (mPart) part = parseInt(mPart[1], 10);
      
      const mSize = asciiLine.match(/\bsize=(\d+)/);
      if (mSize) totalSize = parseInt(mSize[1], 10);
      
      inData = true;
      continue;
    }
    if (asciiPrefix.startsWith('=ypart')) {
      const mBegin = asciiLine.match(/\bbegin=(\d+)/);
      if (mBegin) begin = parseInt(mBegin[1], 10);
      
      const mEnd = asciiLine.match(/\bend=(\d+)/);
      if (mEnd) end = parseInt(mEnd[1], 10);
      
      continue;
    }
    if (asciiPrefix.startsWith('=yend')) {
       break;
    }

    if (inData && !isUuencode && line.length > 0) decodeYencLine(line, outBytes);
    if (idx === -1) break;
  }

  if (outBytes.length === 0) {
    console.error(`[Decode Debug] Failed to decode! First 10 lines of body:\n` + firstFewLines.join('\n'));
  }

  return { filename, part, begin, end, totalSize, buffer: Buffer.from(outBytes) };
}

function assembleYencParts(decodedParts) {
  if (!decodedParts || decodedParts.length === 0) return null;
  if (decodedParts.length === 1) return { filename: decodedParts[0].filename, buffer: decodedParts[0].buffer };

  // Sort parts by 'begin' offset or 'part' number
  decodedParts.sort((a, b) => {
    if (a.begin && b.begin) return a.begin - b.begin;
    return a.part - b.part;
  });

  const totalBufferLen = decodedParts.reduce((acc, p) => acc + p.buffer.length, 0);
  const resultBuffer = Buffer.alloc(totalBufferLen);
  let offset = 0;
  
  for (const p of decodedParts) {
    p.buffer.copy(resultBuffer, offset);
    offset += p.buffer.length;
  }

  // Use the filename from the first part
  return { filename: decodedParts[0].filename, buffer: resultBuffer };
}

export { decodeYencArticle, decodeYencLine, assembleYencParts };
