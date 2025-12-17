/**
 * 对识别内容进行分类，判断是否需要包含在最终文档中
 * @param {Object} ocrResult - OCR识别结果
 * @returns {Object} 分类结果
 */
export function classifyContent(ocrResult) {
  const { pageNumber, content, rawText } = ocrResult;

  // 确保 content 是字符串
  const contentStr = typeof content === 'string' ? content : String(content || '');

  if (!contentStr || contentStr.trim().length === 0) {
    return {
      pageNumber,
      content: contentStr,
      rawText: contentStr,
      contentType: 'empty',
      shouldInclude: false,
      reason: '空白页'
    };
  }

  const text = contentStr.toLowerCase();

  // 检测是否为目录页
  const isTOC = detectTableOfContents(text, contentStr);
  if (isTOC) {
    return {
      pageNumber,
      content: contentStr,
      rawText: contentStr,
      contentType: 'table_of_contents',
      shouldInclude: false,
      reason: '目录页'
    };
  }

  // 检测是否为附录页
  const isAppendix = detectAppendix(text, contentStr);
  if (isAppendix) {
    return {
      pageNumber,
      content: contentStr,
      rawText: contentStr,
      contentType: 'appendix',
      shouldInclude: false,
      reason: '附录页'
    };
  }

  // 检测是否包含表格
  const hasTable = detectTable(contentStr);
  if (hasTable) {
    return {
      pageNumber,
      content: contentStr,
      rawText: contentStr,
      contentType: 'table',
      shouldInclude: true,
      reason: '包含表格'
    };
  }

  // 默认为正文内容
  return {
    pageNumber,
    content: contentStr,
    rawText: contentStr,
    contentType: 'normal_text',
    shouldInclude: true,
    reason: '正文内容'
  };
}

/**
 * 检测是否为目录页
 */
function detectTableOfContents(lowerText, originalText) {
  // 日语目录关键词
  const tocKeywords = [
    '目次', '目录', 'もくじ',
    'contents', 'table of contents',
    '第一章', '第二章', '第三章',
    '第1章', '第2章', '第3章'
  ];

  // 检查是否包含目录关键词
  const hasTOCKeyword = tocKeywords.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

  if (!hasTOCKeyword) {
    return false;
  }

  // 如果包含很多页码引用(如"...10"、"...20")，很可能是目录
  const pageRefPattern = /\.{2,}\s*\d+/g;
  const pageRefs = originalText.match(pageRefPattern) || [];

  return pageRefs.length >= 3;
}

/**
 * 检测是否为附录页
 */
function detectAppendix(lowerText, originalText) {
  // 日语附录关键词
  const appendixKeywords = [
    '付録', '附录', 'ふろく',
    'appendix', 'supplement',
    '参考資料', '参考资料'
  ];

  // 检查是否包含附录关键词（通常在页面开头）
  const firstLines = originalText.split('\n').slice(0, 3).join('\n').toLowerCase();

  return appendixKeywords.some(keyword =>
    firstLines.includes(keyword.toLowerCase())
  );
}

/**
 * 检测是否包含表格
 */
function detectTable(text) {
  // 检测Markdown表格格式
  const markdownTablePattern = /\|[^\n]+\|/g;
  const markdownTableMatches = text.match(markdownTablePattern) || [];

  // 如果有3行以上的管道符分隔内容，认为是表格
  if (markdownTableMatches.length >= 3) {
    return true;
  }

  // 检测表格分隔线 (如: |---|---|)
  const tableSeparatorPattern = /\|[\s-]+\|[\s-]+\|/;
  if (tableSeparatorPattern.test(text)) {
    return true;
  }

  return false;
}
