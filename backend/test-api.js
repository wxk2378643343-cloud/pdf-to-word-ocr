import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';

dotenv.config();

const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY;
const DOUBAO_API_ENDPOINT = process.env.DOUBAO_API_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3';

console.log('开始测试豆包 API 连接...');
console.log('API Endpoint:', DOUBAO_API_ENDPOINT);
console.log('API Key:', DOUBAO_API_KEY ? '已配置' : '未配置');
console.log('---');

// 测试 1: 使用 axios，禁用代理
async function test1() {
  console.log('\n测试 1: axios 请求 (proxy: false)');
  try {
    const response = await axios.post(
      `${DOUBAO_API_ENDPOINT}/responses`,
      {
        model: 'doubao-seed-1-6-vision-250815',
        input: [{
          role: 'user',
          content: [{
            type: 'input_text',
            text: '你好'
          }]
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${DOUBAO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        proxy: false
      }
    );
    console.log('✓ 成功！状态码:', response.status);
    console.log('响应:', JSON.stringify(response.data, null, 2).substring(0, 200));
  } catch (error) {
    console.log('✗ 失败:', error.message);
    if (error.response) {
      console.log('  状态码:', error.response.status);
      console.log('  响应头:', error.response.headers);
    }
  }
}

// 测试 2: 完全自定义 httpAgent 和 httpsAgent
async function test2() {
  console.log('\n测试 2: axios 请求 (自定义 agent)');
  try {
    const response = await axios.post(
      `${DOUBAO_API_ENDPOINT}/responses`,
      {
        model: 'doubao-seed-1-6-vision-250815',
        input: [{
          role: 'user',
          content: [{
            type: 'input_text',
            text: '你好'
          }]
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${DOUBAO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        httpAgent: new http.Agent({ keepAlive: false }),
        httpsAgent: new https.Agent({ keepAlive: false, rejectUnauthorized: true }),
        proxy: false
      }
    );
    console.log('✓ 成功！状态码:', response.status);
    console.log('响应:', JSON.stringify(response.data, null, 2).substring(0, 200));
  } catch (error) {
    console.log('✗ 失败:', error.message);
    if (error.response) {
      console.log('  状态码:', error.response.status);
      console.log('  响应头:', error.response.headers);
    }
  }
}

// 测试 3: 检查环境变量中的代理设置
function test3() {
  console.log('\n测试 3: 检查环境变量');
  console.log('HTTP_PROXY:', process.env.HTTP_PROXY || '未设置');
  console.log('HTTPS_PROXY:', process.env.HTTPS_PROXY || '未设置');
  console.log('NO_PROXY:', process.env.NO_PROXY || '未设置');
  console.log('http_proxy:', process.env.http_proxy || '未设置');
  console.log('https_proxy:', process.env.https_proxy || '未设置');
}

// 运行所有测试
async function runTests() {
  test3();
  await test1();
  await test2();
  console.log('\n测试完成！');
}

runTests().catch(console.error);
