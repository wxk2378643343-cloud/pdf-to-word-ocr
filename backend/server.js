import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import archiver from 'archiver';
import { processPDFPage } from './utils/pdfProcessor.js';
import { recognizeImage } from './utils/doubaoAPI.js';
import { classifyContent } from './utils/contentClassifier.js';
import { generateWordDocument, generateSinglePageDocument } from './utils/wordGenerator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 任务存储（生产环境应该用Redis或数据库）
const tasks = new Map();

// 配置CORS
app.use(cors());
app.use(express.json());

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads';
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只支持PDF文件'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB限制
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// PDF上传接口 - 只上传，返回taskId
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传PDF文件' });
    }
    const { startPage, endPage } = req.body;
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pdfPath = req.file.path;

    // 提取原始PDF文件名（不包括扩展名）
    const pdfBaseName = path.basename(req.file.originalname, '.pdf');

    // 创建任务
    tasks.set(taskId, {
      id: taskId,
      pdfPath,
      pdfBaseName,
      startPage: parseInt(startPage) || 1,
      endPage: parseInt(endPage) || null,
      status: 'pending',
      progress: 0,
      totalPages: 0,
      currentPage: 0,
      processedPages: [],
      errors: [],
      createdAt: new Date()
    });

    res.json({
      success: true,
      taskId,
      message: '文件上传成功，请开始处理'
    });

  } catch (error) {
    console.error('============ 上传错误详情 ============');
    console.error('错误消息:', error.message);
    console.error('错误堆栈:', error.stack);
    console.error('错误对象:', error);
    console.error('=====================================');
    res.status(500).json({
      error: '上传失败',
      message: error.message,
      stack: error.stack
    });
  }
});

// SSE进度推送接口
app.get('/api/progress/:taskId', (req, res) => {
  const { taskId } = req.params;

  // 设置SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 发送初始连接消息
  res.write(`data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`);

  // 定期发送进度更新
  const intervalId = setInterval(() => {
    const task = tasks.get(taskId);

    if (!task) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: '任务不存在' })}\n\n`);
      clearInterval(intervalId);
      res.end();
      return;
    }

    // 发送进度
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      status: task.status,
      progress: task.progress,
      currentPage: task.currentPage,
      totalPages: task.totalPages,
      errors: task.errors.length
    })}\n\n`);

    // 如果任务完成或失败，结束连接
    if (task.status === 'completed' || task.status === 'failed') {
      clearInterval(intervalId);
      setTimeout(() => res.end(), 1000);
    }
  }, 1000); // 每秒更新一次

  // 客户端断开连接时清理
  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
});

// 开始处理任务
app.post('/api/process/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const task = tasks.get(taskId);

  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  if (task.status === 'processing') {
    return res.status(400).json({ error: '任务正在处理中' });
  }

  // 立即返回，后台处理
  res.json({ success: true, message: '开始处理' });

  // 异步处理任务
  processTask(taskId).catch(error => {
    console.error('处理任务失败:', error);
    const task = tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error.message;
    }
  });
});

// 暂停任务
app.post('/api/pause/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = tasks.get(taskId);

  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  task.status = 'paused';
  res.json({ success: true, message: '任务已暂停' });
});

// 继续任务
app.post('/api/resume/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const task = tasks.get(taskId);

  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  if (task.status !== 'paused') {
    return res.status(400).json({ error: '任务未暂停' });
  }

  res.json({ success: true, message: '继续处理' });

  // 继续处理
  processTask(taskId).catch(error => {
    console.error('继续处理任务失败:', error);
    task.status = 'failed';
    task.error = error.message;
  });
});

// 核心处理函数 - 流式处理
async function processTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) return;

  try {
    task.status = 'processing';

    const { pdfPath, pdfBaseName, startPage, endPage } = task;

    // 0. 创建输出目录
    const outputDir = `./uploads/output-${taskId}`;
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`[${taskId}] 创建输出目录: ${outputDir}`);

    // 1. 获取PDF总页数
    console.log(`[${taskId}] 开始加载PDF: ${pdfPath}`);

    // 使用pdf-parse作为替代方案来获取页数
    const pdfParse = (await import('pdf-parse')).default;
    const pdfBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);
    const totalPages = pdfData.numpages;

    console.log(`[${taskId}] PDF加载成功，共 ${totalPages} 页`);

    const actualEndPage = endPage || totalPages;
    const pageRange = actualEndPage - startPage + 1;

    task.totalPages = pageRange;
    console.log(`任务 ${taskId}: 共 ${totalPages} 页，处理范围: ${startPage}-${actualEndPage}`);

    // 2. 逐页处理
    for (let pageNum = startPage; pageNum <= actualEndPage; pageNum++) {
      // 检查是否暂停
      if (task.status === 'paused') {
        console.log(`任务 ${taskId} 已暂停在第 ${pageNum} 页`);
        return;
      }

      task.currentPage = pageNum;
      task.progress = Math.round(((pageNum - startPage) / pageRange) * 100);

      try {
        console.log(`[${taskId}] 处理第 ${pageNum}/${actualEndPage} 页...`);

        // 2.1 转换单页为图片
        const imageData = await processPDFPage(pdfPath, pageNum);

        // 2.2 调用OCR识别
        const ocrResult = await recognizeImage(imageData, pageNum);

        // 2.3 内容分类
        const classifiedContent = classifyContent(ocrResult);

        // 2.4 生成单页Word文档
        const pageData = {
          pageNumber: pageNum,
          ...classifiedContent,
          usage: ocrResult.usage
        };

        // 生成六位随机数字
        const randomDigits = Math.floor(100000 + Math.random() * 900000);
        const wordFileName = `${pdfBaseName}_${pageNum}_${randomDigits}.docx`;

        // 使用 base64 图片数据生成 Word 文档
        const wordBuffer = await generateSinglePageDocument(pageData, imageData.image);
        const wordPath = path.join(outputDir, wordFileName);
        await fs.writeFile(wordPath, wordBuffer);
        console.log(`[${taskId}] 第 ${pageNum} 页 Word 文档已生成: ${wordPath}`);

        // 2.5 保存结果
        task.processedPages.push(pageData);

        console.log(`[${taskId}] 第 ${pageNum} 页完成 - ${classifiedContent.contentType}`);

      } catch (error) {
        console.error(`[${taskId}] 第 ${pageNum} 页出错:`, error.message);

        // 记录错误但继续处理
        task.errors.push({
          pageNumber: pageNum,
          error: error.message,
          timestamp: new Date()
        });

        // 如果错误太多，停止处理
        if (task.errors.length > 10) {
          throw new Error('错误过多，停止处理');
        }
      }

      // 短暂延迟，避免API限流
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. 完成处理
    console.log(`[${taskId}] 所有页面处理完成`);

    task.status = 'completed';
    task.progress = 100;
    task.outputDir = outputDir;
    task.outputFile = `output-${taskId}`; // 文件夹名称
    task.completedAt = new Date();

    console.log(`[${taskId}] 处理完成! 总页数: ${task.processedPages.length}`);
    console.log(`[${taskId}] 输出目录: ${outputDir}`);

    // 清理PDF文件
    await fs.unlink(pdfPath).catch(e => console.error('删除PDF失败:', e));

  } catch (error) {
    console.error(`============ [${taskId}] 处理失败详情 ============`);
    console.error('错误消息:', error.message);
    console.error('错误堆栈:', error.stack);
    console.error('错误对象:', error);
    console.error('================================================');
    task.status = 'failed';
    task.error = error.message;
  }
}

// 获取任务状态
app.get('/api/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = tasks.get(taskId);

  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  res.json({
    id: task.id,
    status: task.status,
    progress: task.progress,
    currentPage: task.currentPage,
    totalPages: task.totalPages,
    processedPages: task.processedPages.length,
    errors: task.errors.length,
    outputFile: task.outputFile
  });
});

// 下载生成的结果（打包成zip）
app.get('/api/download/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const outputDir = `./uploads/output-${taskId}`;

    // 获取任务信息以获取PDF原始文件名
    const task = tasks.get(taskId);
    const pdfBaseName = task?.pdfBaseName || 'result';

    // 检查目录是否存在
    try {
      await fs.access(outputDir);
    } catch {
      return res.status(404).json({ error: '输出文件夹不存在' });
    }

    // 创建 zip 文件
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    });

    // 生成六位随机数字
    const randomDigits = Math.floor(100000 + Math.random() * 900000);

    // 设置响应头
    res.attachment(`${pdfBaseName}_${randomDigits}.zip`);

    // 错误处理
    archive.on('error', (err) => {
      console.error('打包错误:', err);
      res.status(500).json({ error: '打包失败' });
    });

    // 将 archive 输出到响应流
    archive.pipe(res);

    // 添加整个文件夹到 zip
    archive.directory(outputDir, false);

    // 完成打包
    await archive.finalize();

    console.log(`任务 ${taskId} 的结果已下载`);

  } catch (error) {
    console.error('下载错误:', error);
    res.status(500).json({ error: '下载失败' });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API密钥已配置: ${process.env.DOUBAO_API_KEY ? '是' : '否'}`);
});
