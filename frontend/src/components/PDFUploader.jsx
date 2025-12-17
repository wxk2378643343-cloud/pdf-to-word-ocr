import { useState, useRef } from 'react'
import axios from 'axios'
import './PDFUploader.css'

function PDFUploader({ onUploadSuccess }) {
  const [file, setFile] = useState(null)
  const [startPage, setStartPage] = useState('')
  const [endPage, setEndPage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setError(null)
    } else {
      setError('请选择PDF文件')
      setFile(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('请先选择PDF文件')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // 1. 上传PDF文件
      const formData = new FormData()
      formData.append('pdf', file)
      if (startPage) formData.append('startPage', startPage)
      if (endPage) formData.append('endPage', endPage)

      const uploadResponse = await axios.post('/api/upload-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      const { taskId } = uploadResponse.data

      // 2. 开始处理任务
      await axios.post(`/api/process/${taskId}`)

      // 3. 通知父组件上传成功
      onUploadSuccess(taskId)

    } catch (err) {
      console.error('上传失败:', err)
      setError(err.response?.data?.message || '上传失败，请重试')
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile)
      setError(null)
    } else {
      setError('请拖放PDF文件')
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  return (
    <div className="uploader">
      <div
        className={`upload-area ${file ? 'has-file' : ''}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={uploading}
        />

        {!file ? (
          <div className="upload-prompt">
            <div className="upload-icon">📁</div>
            <p className="upload-text">点击或拖放PDF文件到这里</p>
            <p className="upload-hint">支持最大100MB的PDF文件</p>
          </div>
        ) : (
          <div className="file-info">
            <div className="file-icon">📄</div>
            <div className="file-details">
              <p className="file-name">{file.name}</p>
              <p className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {!uploading && (
              <button
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      <div className="options">
        <div className="option-group">
          <label>页码范围（可选）</label>
          <div className="page-range">
            <input
              type="number"
              placeholder="起始页"
              value={startPage}
              onChange={(e) => setStartPage(e.target.value)}
              disabled={uploading}
              min="1"
            />
            <span>至</span>
            <input
              type="number"
              placeholder="结束页"
              value={endPage}
              onChange={(e) => setEndPage(e.target.value)}
              disabled={uploading}
              min="1"
            />
          </div>
          <p className="option-hint">留空则处理全部页面</p>
        </div>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      <button
        className={`upload-btn ${uploading ? 'uploading' : ''}`}
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? '上传中...' : '开始识别'}
      </button>
    </div>
  )
}

export default PDFUploader
