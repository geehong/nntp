/**
 * Independent Article Filter Utility Pipeline
 */

// Extensions Media Type mapping
export const getMediaTypeOfSubject = (subject) => {
  if (!subject) return 'other';
  const sub = subject.toLowerCase();
  if (/\.(jpg|jpeg|gif|png|bmp|webp|tiff|jfif)(\b|\.|\s|")/i.test(sub)) return 'image';
  if (/\.(mp4|mkv|avi|wmv|m4v|mov|flv|mpg|mpeg|ts|m2ts|vob|webm)(\b|\.|\s|")/i.test(sub)) return 'video';
  if (/\.(mp3|flac|wav|aac|m4a|ogg|wma|ape)(\b|\.|\s|")/i.test(sub)) return 'audio';
  if (/\.(rar|zip|7z|par2|pdf|iso|tar|gz|r\d{2}|0\d{2})(\b|\.|\s|")/i.test(sub)) return 'archive';
  return 'other';
};

// Age mapping (in days)
export const MAX_AGE_DAYS_MAP = {
  '24h': 1,
  '3d': 3,
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  '2y': 730,
  '3y': 1095,
  '5y': 1825,
  '10y': 3650,
};

export const getAgeInDays = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
};

export const isRandomHashSubject = (subject) => {
  if (!subject) return false;
  const trimmed = subject.trim();
  const isHashPattern = /^[a-zA-Z0-9+/_-]{8,128}=*$/.test(trimmed);
  const hasExtensionOrPart = /\.(mp4|mkv|avi|wmv|rar|zip|7z|par2|jpg|png|gif|nfo|txt)\b/i.test(trimmed) || /\d+[\/\s]\d+/.test(trimmed);
  return isHashPattern && !hasExtensionOrPart;
};

/**
 * Pure Fast Filter Pipeline
 */
export function filterArticles(articles, options = {}) {
  if (!Array.isArray(articles)) return [];

  const {
    searchQuery = '',
    mediaType = 'all',
    age = 'all',
    minSizeMB = '',
    maxSizeMB = '',
    readStatus = 'all',
    hideRandomHash = true,
    expandSplitParts = false,
    readArticleIds = new Set(),
  } = options;

  const q = searchQuery.toLowerCase().trim();

  return articles.filter((item) => {
    if (!item || !item.subject) return true;

    // 1. Hide Random Hash Subjects
    if (hideRandomHash && isRandomHashSubject(item.subject)) {
      return false;
    }

    // 2. Hide Split Parts when expandSplitParts is false (unchecked by default)
    // Ignore [1/1] or (1/1) single-file patterns; only match multi-part splits like [1/15], (2/50)
    if (!expandSplitParts) {
      const match = item.subject.match(/(?:[\(\[\{])\s*(\d+)\s*[\/\s|of]+\s*(\d+)\s*(?:[\)\]\}])/i);
      if (match) {
        const totalParts = parseInt(match[2], 10);
        if (totalParts > 1) {
          return false;
        }
      }
    }

    // 3. Subject Search Query
    if (q && !item.subject.toLowerCase().includes(q)) {
      return false;
    }

    // 4. Media Type Filter
    if (mediaType !== 'all') {
      const type = getMediaTypeOfSubject(item.subject);
      if (type !== mediaType) return false;
    }

    // 5. Age / Date Filter
    if (age !== 'all' && MAX_AGE_DAYS_MAP[age]) {
      const ageDays = getAgeInDays(item.date);
      if (ageDays !== null && ageDays > MAX_AGE_DAYS_MAP[age]) {
        return false;
      }
    }

    // 6. Size (Min/Max MB) Filter
    const bytes = parseInt(item.bytes, 10) || 0;
    if (minSizeMB !== '' && !isNaN(Number(minSizeMB))) {
      const minBytes = Number(minSizeMB) * 1024 * 1024;
      if (bytes < minBytes) return false;
    }
    if (maxSizeMB !== '' && !isNaN(Number(maxSizeMB))) {
      const maxBytes = Number(maxSizeMB) * 1024 * 1024;
      if (bytes > maxBytes) return false;
    }

    // 7. Read Status Filter
    if (readStatus !== 'all') {
      const isRead = readArticleIds.has(item.id);
      if (readStatus === 'unread' && isRead) return false;
      if (readStatus === 'read' && !isRead) return false;
    }

    return true;
  });
}

export function computeArticleStats(articles) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return {
      completeParts: 0,
      incompleteParts: 0,
      picNoParts: 0,
      textNoParts: 0,
      etcNoParts: 0,
    };
  }

  const partGroups = {};
  let picNoParts = 0;
  let textNoParts = 0;
  let etcNoParts = 0;

  articles.forEach((item) => {
    if (!item || !item.subject) return;
    const sub = item.subject;

    const partMatch = sub.match(/(?:[\(\[\{])\s*(\d+)\s*[\/\s|of]+\s*(\d+)\s*(?:[\)\]\}])/i);

    if (partMatch) {
      const partNum = parseInt(partMatch[1], 10);
      const totalParts = parseInt(partMatch[2], 10);
      const baseKey = sub.replace(/(?:[\(\[\{])\s*\d+\s*[\/\s|of]+\s*\d+\s*(?:[\)\]\}])/gi, '').trim().toLowerCase();

      if (!partGroups[baseKey]) {
        partGroups[baseKey] = {
          totalParts: totalParts > 0 ? totalParts : 0,
          count: 0,
          partsSeen: new Set(),
        };
      }
      partGroups[baseKey].count += 1;
      if (partNum > 0) {
        partGroups[baseKey].partsSeen.add(partNum);
      }
    } else {
      const lower = sub.toLowerCase();
      if (/\.(jpe?g|png|gif|webp|bmp)(\b|\.|\s|")/i.test(lower)) {
        picNoParts += 1;
      } else if (/\.(txt|nfo|sfv|csv|json|xml|html|md|srt|sub|doc|docx|pdf)(\b|\.|\s|")/i.test(lower)) {
        textNoParts += 1;
      } else {
        etcNoParts += 1;
      }
    }
  });

  let completeParts = 0;
  let incompleteParts = 0;

  Object.values(partGroups).forEach((grp) => {
    const isComplete = grp.totalParts > 0 && (grp.partsSeen.size >= grp.totalParts || grp.count >= grp.totalParts);
    if (isComplete) {
      completeParts += grp.count;
    } else {
      incompleteParts += grp.count;
    }
  });

  return {
    completeParts,
    incompleteParts,
    picNoParts,
    textNoParts,
    etcNoParts,
  };
}

export default filterArticles;
