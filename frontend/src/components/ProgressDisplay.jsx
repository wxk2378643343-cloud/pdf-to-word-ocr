import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './ProgressDisplay.css'

function ProgressDisplay({ taskId, onComplete, onReset }) {
  const [status, setStatus] = useState('pending')
  const [progress, setProgress] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [errors, setErrors] = useState(0)
  const [outputFile, setOutputFile] = useState(null)
  const eventSourceRef = useRef(null)

  useEffect(() => {
    // 连接SSE获取实时进度
    const eventSource = new EventSource(`http://localhost:3001/api/progress/${taskId}`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'connected') {
          console.log('连接成功:', data.taskId)
        } else if (data.type === 'progress') {
          setStatus(data.status)
          setProgress(data.progress)
          setCurrentPage(data.currentPage)
          setTotalPages(data.totalPages)
          setErrors(data.errors)

          // 如果完成，获取输出文件
          if (data.status === 'completed') {
            fetchTaskDetails()
          }
        } else if (data.type === 'error') {
          console.error('任务错误:', data.message)
          setStatus('failed')
        }
      } catch (err) {
        console.error('解析SSE数据失败:', err)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE连接错误:', error)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [taskId])

  const fetchTaskDetails = async () => {
    try {
      const response = await axios.get(`/api/task/${taskId}`)
      if (response.data.outputFile) {
        setOutputFile(response.data.outputFile)
        onComplete()
      }
    } catch (error) {
      console.error('获取任务详情失败:', error)
    }
  }

  const handlePause = async () => {
    try {
      await axios.post(`/api/pause/${taskId}`)
    } catch (error) {
      console.error('暂停失败:', error)
    }
  }

  const handleResume = async () => {
    try {
      await axios.post(`/api/resume/${taskId}`)
    } catch (error) {
      console.error('继续失败:', error)
    }
  }

  const handleDownload = () => {
    // 直接使用 taskId 下载 ZIP 压缩包
    window.location.href = `http://localhost:3001/api/download/${taskId}`
  }

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return '准备中...'
      case 'processing':
        return '识别中...'
      case 'paused':
        return '已暂停'
      case 'generating':
        return '生成Word文档...'
      case 'completed':
        return '完成!'
      case 'failed':
        return '失败'
      default:
        return status
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return '#667eea'
      case 'paused':
        return '#ffa502'
      case 'completed':
        return '#2ed573'
      case 'failed':
        return '#ff4757'
      default:
        return '#888'
    }
  }

  return (
    <div className="progress-display">
      <div className="status-header">
        <div className="status-badge" style={{ backgroundColor: getStatusColor() }}>
          {getStatusText()}
        </div>
        {totalPages > 0 && (
          <div className="page-counter">
            第 {currentPage} / {totalPages} 页
          </div>
        )}
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{
            width: `${progress}%`,
            backgroundColor: getStatusColor()
          }}
        >
          <span className="progress-text">{progress}%</span>
        </div>
      </div>

      <div className="stats">
        <div className="stat-item">
          <div className="stat-label">总页数</div>
          <div className="stat-value">{totalPages}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">当前页</div>
          <div className="stat-value">{currentPage}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">进度</div>
          <div className="stat-value">{progress}%</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">错误</div>
          <div className="stat-value error">{errors}</div>
        </div>
      </div>

      {status === 'processing' && (
        <div className="processing-info">
          <div className="spinner"></div>
          <p>正在使用豆包AI识别第 {currentPage} 页...</p>
          <p className="hint">大文件处理可能需要较长时间，请耐心等待</p>
        </div>
      )}

      {status === 'generating' && (
        <div className="processing-info">
          <div className="spinner"></div>
          <p>正在生成Word文档...</p>
        </div>
      )}

      {status === 'completed' && (
        <div className="success-info">
          <div className="success-icon">✓</div>
          <h3>识别完成!</h3>
          <p>已成功识别 {totalPages} 页内容</p>
          <p className="hint">每页都已生成独立的 Word 文档（包含图片和文本）</p>
          <button className="download-btn" onClick={handleDownload}>
            📦 下载压缩包
          </button>
        </div>
      )}

      {status === 'failed' && (
        <div className="error-info">
          <div className="error-icon">✕</div>
          <h3>处理失败</h3>
          <p>请检查PDF文件或稍后重试</p>
        </div>
      )}

      <div className="controls">
        {status === 'processing' && (
          <button className="control-btn pause" onClick={handlePause}>
            ⏸️ 暂停
          </button>
        )}

        {status === 'paused' && (
          <button className="control-btn resume" onClick={handleResume}>
            ▶️ 继续
          </button>
        )}

        {(status === 'completed' || status === 'failed') && (
          <button className="control-btn reset" onClick={onReset}>
            🔄 重新上传
          </button>
        )}
      </div>
    </div>
  )
}

export default ProgressDisplay
