# 日语 PDF OCR 转 Word

![Node.js](https://img.shields.io/badge/Node.js-2563EB?style=flat-square)
![Express](https://img.shields.io/badge/Express-0F766E?style=flat-square)
![React](https://img.shields.io/badge/React-334155?style=flat-square)
![Canvas](https://img.shields.io/badge/Canvas-B45309?style=flat-square)
![豆包视觉模型](https://img.shields.io/badge/%E8%B1%86%E5%8C%85%E8%A7%86%E8%A7%89%E6%A8%A1%E5%9E%8B-6D28D9?style=flat-square)

## 📌 项目简介

将日语 PDF 的指定页转换为 Word。用户上传文件后可以选择页码、查看处理进度并下载结果。

## 🏗️ 系统架构

- React 页面提交文件，Express 管理任务并通过 SSE 推送进度。
- 后端渲染 PDF 页面，将图像交给配置的视觉模型识别，再生成 Word 文件。

## 📁 项目结构

| 路径 | 用途 |
| --- | --- |
| [`frontend`](frontend) | 上传、进度与下载界面 |
| [`backend`](backend) | PDF 渲染、OCR 和 Word 生成 |
| [`docker`](docker) | 镜像构建和 Nginx 配置 |

## 🚀 如何启动

Docker 内包含 PDF 渲染依赖。先准备豆包 API 密钥，再选择 Docker 或本地开发方式。

### Docker 本地部署

需要 Docker 和 Compose v2。在仓库根目录创建 `.env`，填写以下变量。

```dotenv
DOUBAO_API_KEY=replace_with_your_api_key
DOUBAO_MODEL=doubao-seed-1.6-vision
APP_PORT=3000
```

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

打开 [http://localhost:3000](http://localhost:3000)。也可使用 `curl http://localhost:3000/health` 检查 API。

镜像内安装了 `canvas` 所需的系统库和 CJK 字体。页面、API、进度流与下载共用同一入口。上传和生成文件保存在 `documents` 数据卷，内存中的任务状态会随服务重启丢失。OCR 会将页面图像发送至配置的豆包 API，因此请先确认待处理文件可以交给该服务。

使用 `docker compose logs --tail=100` 查看日志。使用 `docker compose down` 停止服务并保留数据卷。

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/wxk2378643343-cloud/pdf-to-word-ocr.git
cd pdf-to-word-ocr
```

#### 2. 配置后端

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

#### 3. 配置前端

```bash
cd ../frontend
npm install
```

### 获取豆包API密钥

1. 访问 [火山引擎控制台](https://console.volcengine.com/)
2. 注册/登录账号
3. 进入「火山方舟」服务
4. 创建API密钥
5. 每个模型有 **50万tokens免费额度**

### 运行项目

#### 开发模式

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

## 功能特点

✅ **逐页流式处理** - 支持500+页大文件，内存占用低
✅ **实时进度显示** - SSE实时推送处理进度
✅ **智能内容分类** - 自动跳过目录、附录页
✅ **表格识别** - 识别并保留表格结构
✅ **暂停/继续** - 支持处理过程中暂停和继续
✅ **错误处理** - 单页失败不影响整体，自动跳过
✅ **页码范围** - 可指定处理特定页码范围

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
