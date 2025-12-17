import { useState } from 'react'
import PDFUploader from './components/PDFUploader'
import ProgressDisplay from './components/ProgressDisplay'
import './App.css'

function App() {
  const [taskId, setTaskId] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleUploadSuccess = (newTaskId) => {
    setTaskId(newTaskId)
    setIsProcessing(true)
  }

  const handleProcessComplete = () => {
    setIsProcessing(false)
  }

  const handleReset = () => {
    setTaskId(null)
    setIsProcessing(false)
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>📄 PDF日语OCR识别转Word</h1>
          <p>使用豆包AI识别日语PDF内容并生成Word文档</p>
        </header>

        {!taskId ? (
          <PDFUploader onUploadSuccess={handleUploadSuccess} />
        ) : (
          <ProgressDisplay
            taskId={taskId}
            onComplete={handleProcessComplete}
            onReset={handleReset}
          />
        )}

        <footer className="footer">
          <p>支持最大100MB的PDF文件 • 自动跳过目录和附录 • 保留表格结构</p>
        </footer>
      </div>
    </div>
  )
}

export default App
