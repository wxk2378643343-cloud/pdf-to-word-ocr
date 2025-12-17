# PDF日语OCR识别转Word

使用豆包AI（Doubao-Seed-1.6-vision）识别日语PDF内容并生成Word文档的全栈应用。

## 功能特点

✅ **逐页流式处理** - 支持500+页大文件，内存占用低
✅ **实时进度显示** - SSE实时推送处理进度
✅ **智能内容分类** - 自动跳过目录、附录页
✅ **表格识别** - 识别并保留表格结构
✅ **暂停/继续** - 支持处理过程中暂停和继续
✅ **错误处理** - 单页失败不影响整体，自动跳过
✅ **页码范围** - 可指定处理特定页码范围

## 技术栈

**后端：** Node.js + Express + PDF.js + Docx + 豆包API
**前端：** React + Vite + Axios + SSE

## 安装步骤

### 1. 克隆项目

```bash
cd pdf-to-word-ocr
```

### 2. 配置后端

```bash
cd backend
npm install
```

创建 `.env` 文件（复制 `.env.example`）：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的豆包API密钥：

```env
DOUBAO_API_KEY=你的API密钥
DOUBAO_API_ENDPOINT=https://ark.cn-beijing.volces.com/api/v3
PORT=3001
DOUBAO_MODEL=doubao-seed-1.6-vision
```

### 3. 配置前端

```bash
cd ../frontend
npm install
```

## 获取豆包API密钥

1. 访问 [火山引擎控制台](https://console.volcengine.com/)
2. 注册/登录账号
3. 进入「火山方舟」服务
4. 创建API密钥
5. 每个模型有 **50万tokens免费额度**

## 运行项目

### 开发模式

打开两个终端窗口：

**终端1 - 启动后端：**
```bash
cd backend
npm run dev
# 或
npm start
```

**终端2 - 启动前端：**
```bash
cd frontend
npm run dev
```

访问：http://localhost:3000

## 使用说明

1. **上传PDF文件**
   - 点击或拖放PDF文件到上传区域
   - 支持最大100MB文件

2. **设置页码范围（可选）**
   - 留空则处理全部页面
   - 指定范围可节省token消耗

3. **开始识别**
   - 点击「开始识别」按钮
   - 实时查看处理进度

4. **下载结果**
   - 处理完成后点击「下载Word文档」
   - Word文档包含识别的日语文字和表格

## API接口说明

### 上传PDF
```
POST /api/upload-pdf
Content-Type: multipart/form-data

Body:
- pdf: PDF文件
- startPage: 起始页（可选）
- endPage: 结束页（可选）

Response:
{
  "success": true,
  "taskId": "task-xxx",
  "message": "文件上传成功"
}
```

### 开始处理
```
POST /api/process/:taskId

Response:
{
  "success": true,
  "message": "开始处理"
}
```

### 实时进度（SSE）
```
GET /api/progress/:taskId

SSE Events:
{
  "type": "progress",
  "status": "processing",
  "progress": 50,
  "currentPage": 10,
  "totalPages": 20,
  "errors": 0
}
```

### 暂停任务
```
POST /api/pause/:taskId
```

### 继续任务
```
POST /api/resume/:taskId
```

### 下载文件
```
GET /api/download/:filename
```

## 成本估算

基于豆包API定价（2025年）：
- 输入：0.8元/百万tokens
- 输出：8元/百万tokens

**单页成本：** 约 0.015-0.02元
**100页PDF：** 约 1.5-2元
**500页PDF：** 约 7.5-10元

**免费额度：** 50万tokens ≈ 150-250页

## 内容分类规则

应用会自动识别以下类型的页面：

### ❌ 自动跳过
- **目录页**：包含"目次"、"目录"等关键词
- **附录页**：包含"付録"、"附录"等关键词

### ✅ 保留处理
- **表格页**：识别为Markdown表格并转换为Word表格
- **正文页**：普通文字内容

## 项目结构

```
pdf-to-word-ocr/
├── backend/                 # 后端服务
│   ├── server.js           # Express服务器
│   ├── utils/
│   │   ├── pdfProcessor.js # PDF转图片
│   │   ├── doubaoAPI.js    # 豆包API调用
│   │   ├── contentClassifier.js # 内容分类
│   │   └── wordGenerator.js     # Word生成
│   ├── package.json
│   └── .env.example
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── PDFUploader.jsx    # 上传组件
│   │   │   └── ProgressDisplay.jsx # 进度显示
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 常见问题

### Q: 处理500页需要多长时间？
A: 每页约3-5秒，500页大约需要25-40分钟。建议分批处理。

### Q: 识别准确率如何？
A: 豆包1.6 vision模型对日语识别准确率较高，但建议人工校对重要文档。

### Q: 表格识别效果如何？
A: 模型会将表格识别为Markdown格式，然后转换为Word表格。复杂表格可能需要调整。

### Q: 出错了怎么办？
A: 单页错误不会影响整体处理，最多允许10页错误。可在日志中查看详细错误信息。

### Q: 如何优化识别效果？
A:
- 确保PDF清晰度足够
- 可在 `pdfProcessor.js` 中调整 `scale` 参数提高分辨率
- 可在 `doubaoAPI.js` 中优化提示词

## 性能优化建议

1. **分批处理**：将大PDF分成多个小文件
2. **调整分辨率**：降低scale值可提高速度但降低准确率
3. **并发控制**：可添加并发请求控制避免API限流
4. **使用Redis**：生产环境建议用Redis存储任务状态

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

如有问题，请提交Issue或联系开发者。
