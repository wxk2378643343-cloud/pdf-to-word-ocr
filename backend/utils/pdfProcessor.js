import { createCanvas, loadImage } from 'canvas';

// 使用默认导入方式加载 pdfjs-dist (CommonJS 模块)
const pdfjsLib = await import('pdfjs-dist');

/**
 * 处理PDF的单个页面，转换为Base64图片
 * @param {string} pdfPath - PDF文件路径
 * @param {number} pageNumber - 页码
 * @returns {Promise<{pageNumber: number, image: string}>}
 */
export async function processPDFPage(pdfPath, pageNumber) {
  try {
    console.log(`开始处理第 ${pageNumber} 页...`);

    // 加载PDF文档
    const getDocument = pdfjsLib.default?.getDocument || pdfjsLib.getDocument;
    const loadingTask = getDocument({
      url: pdfPath,
      verbosity: 0 // 关闭详细日志
    });

    const pdfDocument = await loadingTask.promise;

    // 获取指定页面
    const page = await pdfDocument.getPage(pageNumber);

    // 设置渲染参数，提高分辨率以获得更好的OCR效果
    const viewport = page.getViewport({ scale: 2.0 });

    // 创建Canvas
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // 渲染PDF页面到Canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    // 转换为Base64
    const imageBase64 = canvas.toBuffer('image/png').toString('base64');

    // 清理资源
    page.cleanup();
    await pdfDocument.cleanup();

    console.log(`第 ${pageNumber} 页转换完成`);

    return {
      pageNumber,
      image: imageBase64
    };

  } catch (error) {
    console.error(`处理第 ${pageNumber} 页失败:`, error);
    throw new Error(`处理第 ${pageNumber} 页失败: ${error.message}`);
  }
}
