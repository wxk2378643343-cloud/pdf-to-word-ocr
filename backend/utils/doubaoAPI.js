import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';

dotenv.config();

const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY;
const DOUBAO_API_ENDPOINT = process.env.DOUBAO_API_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL = process.env.DOUBAO_MODEL || 'doubao-seed-1.6-vision';

/**
 * 调用豆包API进行图像识别
 * @param {string} imageBase64 - Base64编码的图片
 * @param {number} pageNumber - 页码
 * @returns {Promise<Object>} 识别结果
 */
export async function recognizeImage(imageData, pageNumber) {
  try {
    if (!DOUBAO_API_KEY) {
      throw new Error('未配置DOUBAO_API_KEY环境变量');
    }

    const { image } = imageData;

    // 构建请求消息 (使用豆包responses API格式)
    const input = [
      {
        role: 'user',
        content: [
          {
            type: 'input_image',
            image_url: `data:image/png;base64,${image}`
          },
          {
            type: 'input_text',
            text: `请识别这张图片中的日语文字。要求：
1. 准确识别所有日语文字
2. 如果是表格，请保持表格结构，用markdown表格格式输出
3. 如果是表格，除了表格还有文字都要识别返回
4. 保持原文的段落和格式以及表格
5. 只输出识别的文字内容，不要添加额外的解释

请直接输出识别结果。`
          }
        ]
      }
    ];

    // 调用豆包API (使用流式响应)
    const response = await axios.post(
      `${DOUBAO_API_ENDPOINT}/responses`,
      {
        model: MODEL,
        input: input
      },
      {
        headers: {
          'Authorization': `Bearer ${DOUBAO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 1200000, // 60秒超时
        httpAgent: new http.Agent({ keepAlive: false }),
        httpsAgent: new https.Agent({ keepAlive: false, rejectUnauthorized: true }),
        proxy: false, // 禁用代理
        responseType: 'text' // 获取原始文本以处理流式响应
      }
    );

    // 处理响应数据
    let content = '';
    const responseText = response.data;

    console.log('\n==================== 调试信息 ====================');
    console.log(`第 ${pageNumber} 页 - 原始响应类型:`, typeof responseText);
    console.log(`第 ${pageNumber} 页 - 原始响应长度:`, responseText.length);
    console.log(`第 ${pageNumber} 页 - 原始响应前 500 字符:`, responseText.substring(0, 500));

    try {
      // 解析 JSON 响应
      const jsonResponse = JSON.parse(responseText);
      console.log('JSON 解析成功');
      console.log('响应对象 keys:', Object.keys(jsonResponse));
      console.log('是否有 output 字段:', !!jsonResponse.output);
      console.log('output 是否为数组:', Array.isArray(jsonResponse.output));

      // 检查 output 数组
      if (jsonResponse.output && Array.isArray(jsonResponse.output)) {
        console.log('output 数组长度:', jsonResponse.output.length);

        // 遍历 output 数组，查找 type 为 "message" 的对象
        for (let i = 0; i < jsonResponse.output.length; i++) {
          const outputItem = jsonResponse.output[i];
          console.log(`\n--- output[${i}] ---`);
          console.log('type:', outputItem.type);
          console.log('是否有 content:', !!outputItem.content);

          // 找到 message 类型
          if (outputItem.type === 'message' && outputItem.content && Array.isArray(outputItem.content)) {
            console.log('✓ 找到 message 类型！');
            console.log('content 长度:', outputItem.content.length);

            // 查找 output_text 类型的 content
            const textContent = outputItem.content.find(item => item.type === 'output_text');
            console.log('找到的 textContent:', textContent ? '是' : '否');

            if (textContent && textContent.text) {
              content = textContent.text;
              console.log('✓✓ 成功提取 text！');
              console.log('text 类型:', typeof content);
              console.log('text 长度:', content.length);
              console.log('text 前 300 字符:', content.substring(0, 300));
              break; // 找到就退出
            } else {
              console.log('✗ 未找到 output_text 或 text 字段');
              console.log('content 详情:', JSON.stringify(outputItem.content, null, 2).substring(0, 500));
            }
          }
        }
      } else {
        console.log('✗ 响应中没有 output 数组');
      }

      // 如果还是没找到，打印完整的响应结构
      if (!content) {
        console.log('\n⚠️ 未能提取 content，完整响应结构:');
        console.log(JSON.stringify(jsonResponse, null, 2).substring(0, 2000));
      }

    } catch (e) {
      console.log('✗ JSON 解析失败:', e.message);
      console.log('原始响应:', responseText.substring(0, 1000));
    }

    // 确保 content 是字符串
    content = String(content || '');

    console.log('\n========== 最终结果 ==========');
    console.log('最终 content 类型:', typeof content);
    console.log('最终 content 长度:', content.length);
    console.log('最终 content 前 500 字符:', content.substring(0, 500));
    console.log('==================== 调试结束 ====================\n');
    console.log('Token使用:', {
      input: response.data.usage?.prompt_tokens || 0,
      output: response.data.usage?.completion_tokens || 0,
      total: response.data.usage?.total_tokens || 0
    });

    return {
      pageNumber,
      content,
      rawText: content,
      usage: response.data.usage
    };

  } catch (error) {
    console.error(`第 ${pageNumber} 页识别失败:`, error.message);

    if (error.response) {
      console.error('HTTP状态码:', error.response.status);
      console.error('响应头:', error.response.headers);
      console.error('API错误响应:', JSON.stringify(error.response.data, null, 2));

      // 如果是 503 服务不可用错误，抛出更明确的错误信息
      if (error.response.status === 503) {
        throw new Error(`豆包API服务不可用(503)。可能原因：
1. 网络代理问题 - 请检查系统代理设置
2. API endpoint 配置错误 - 当前: ${process.env.DOUBAO_API_ENDPOINT}
3. API 服务暂时不可用 - 请稍后重试
4. API key 无效 - 请检查 API key 配置`);
      }

      // 其他 HTTP 错误也抛出
      throw new Error(`API请求失败 (${error.response.status}): ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error('没有收到响应，请求已发送');
      throw new Error('API请求超时或无法连接到服务器，请检查网络连接');
    } else {
      console.error('请求配置错误:', error.message);
      throw new Error(`请求配置错误: ${error.message}`);
    }
  }
}
