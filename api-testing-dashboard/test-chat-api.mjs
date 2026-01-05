/**
 * Test script for the Chat API
 * Run with: node test-chat-api.mjs
 */

import https from 'https';

const API_KEY = 'AIzaSyDepuFgjuzU4kPIh5XulKDVTKwALE1hqLY';

async function testChatAPI() {
  console.log('=== Chat API Test ===\n');

  const postData = JSON.stringify({
    messages: [{ role: 'user', content: 'Say "Hello World" and nothing else.' }]
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api-testing-dashboard.vercel.app',
      port: 443,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Provider': 'google',
        'X-AI-API-Key': API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('Sending request to production API...');
    console.log('Provider: google (Gemini)');
    console.log('---');

    const req = https.request(options, (res) => {
      console.log('Status:', res.statusCode);
      console.log('Content-Type:', res.headers['content-type']);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk.toString();
      });

      res.on('end', () => {
        console.log('---');
        console.log('Response length:', data.length, 'bytes');
        console.log('Response:', data || '(empty)');
        console.log('---');

        if (res.statusCode === 200 && data.length > 0) {
          console.log('✅ TEST PASSED: Got response from AI');
          resolve(true);
        } else if (res.statusCode === 200 && data.length === 0) {
          console.log('❌ TEST FAILED: Empty response');
          resolve(false);
        } else {
          console.log('❌ TEST FAILED: Non-200 status');
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.log('❌ TEST FAILED: Network error -', e.message);
      reject(e);
    });

    req.setTimeout(60000, () => {
      console.log('❌ TEST FAILED: Request timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// Run test
testChatAPI()
  .then(passed => process.exit(passed ? 0 : 1))
  .catch(() => process.exit(1));
