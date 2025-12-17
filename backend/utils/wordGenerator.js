import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from 'docx';

/**
 * 生成单页Word文档（包含图片和文本）
 * @param {Object} pageData - 单页数据
 * @param {string} imageBase64 - 图片的Base64数据
 * @returns {Promise<Buffer>} Word文档Buffer
 */
export async function generateSinglePageDocument(pageData, imageBase64) {
  const { pageNumber, content, contentType } = pageData;
  const children = [];

  // 添加原始图片（从Base64）
  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: imageBuffer,
            transformation: {
              width: 600,  // 设置图片宽度
              height: 800  // 设置图片高度（根据实际情况调整）
            }
          })
        ],
        spacing: {
          after: 200
        }
      })
    );
  } catch (error) {
    console.error('添加图片失败:', error);
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '（图片加载失败）',
            color: 'FF0000',
            size: 20
          })
        ],
        spacing: { after: 200 }
      })
    );
  }

  // 添加识别的文本内容（不添加额外标题）
  if (contentType === 'table') {
    const tableElements = parseMarkdownTable(content);
    if (tableElements) {
      children.push(...tableElements);
    } else {
      children.push(...parseNormalText(content));
    }
  } else {
    children.push(...parseNormalText(content));
  }

  // 创建Word文档
  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  // 生成Buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * 生成Word文档（合并所有页面）
 * @param {Array} pages - 处理后的页面数据
 * @returns {Promise<Buffer>} Word文档Buffer
 */
export async function generateWordDocument(pages) {
  const children = [];

  for (const page of pages) {
    const { pageNumber, content, contentType } = page;

    // 添加页码注释
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `--- 第 ${pageNumber} 页 ---`,
            color: '999999',
            size: 20
          })
        ],
        spacing: {
          before: 200,
          after: 100
        }
      })
    );

    // 根据内容类型处理
    if (contentType === 'table') {
      // 处理表格内容
      const tableElements = parseMarkdownTable(content);
      if (tableElements) {
        children.push(...tableElements);
      } else {
        // 如果表格解析失败，作为普通文本处理
        children.push(...parseNormalText(content));
      }
    } else {
      // 处理普通文本
      children.push(...parseNormalText(content));
    }

    // 添加页面分隔
    children.push(
      new Paragraph({
        children: [],
        spacing: { after: 200 }
      })
    );
  }

  // 创建Word文档
  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  // 生成Buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * 解析Markdown表格为Word表格
 */
function parseMarkdownTable(text) {
  try {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const tableLines = lines.filter(line => line.includes('|'));

    if (tableLines.length < 2) {
      return null;
    }

    // 解析表格行
    const rows = [];
    for (const line of tableLines) {
      // 跳过分隔线 (如: |---|---|)
      if (/^\|[\s-]+\|/.test(line.trim())) {
        continue;
      }

      // 提取单元格
      const cells = line
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) {
      return null;
    }

    // 创建Word表格
    const tableRows = rows.map((cells, rowIndex) => {
      const tableCells = cells.map(cellText =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cellText,
                  size: 20,
                  font: {
                    name: 'MS Gothic' // 支持日语的字体
                  }
                })
              ]
            })
          ],
          width: {
            size: 100 / cells.length,
            type: WidthType.PERCENTAGE
          }
        })
      );

      return new TableRow({
        children: tableCells
      });
    });

    const table = new Table({
      rows: tableRows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      }
    });

    return [table];

  } catch (error) {
    console.error('解析表格失败:', error);
    return null;
  }
}

/**
 * 解析普通文本为Word段落
 */
function parseNormalText(text) {
  const paragraphs = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      // 空行
      paragraphs.push(
        new Paragraph({
          children: [],
          spacing: { after: 100 }
        })
      );
      continue;
    }

    // 普通段落
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: trimmedLine,
            size: 22,
            font: {
              name: 'MS Gothic' // 支持日语的字体
            }
          })
        ],
        spacing: {
          after: 120
        }
      })
    );
  }

  return paragraphs;
}
