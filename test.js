#!/usr/bin/env node

/**
 * Test script for the AirLabs proxy server
 * Run this after deploying the proxy to verify it works
 */

const https = require('https');

// Configuration - Update these values after deployment
const PROXY_URL = process.env.PROXY_URL || 'https://navifare-proxy-server.onrender.com';
const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY || 'your-api-key-here';
const FARERA_API_KEY = process.env.FARERA_API_KEY || '';
const FARERA_PARTNER_META = process.env.FARERA_PARTNER_META || '';

async function testProxy() {
  console.log('🧪 Testing AirLabs Proxy Server...\n');
  console.log(`📍 Proxy URL: ${PROXY_URL}`);
  console.log(`🔑 AirLabs Key: ${AIRLABS_API_KEY.substring(0, 8)}...\n`);

  // Test 1: Health check
  console.log('1. Testing health endpoint...');
  try {
    const healthResponse = await makeRequest(`${PROXY_URL}/health`);
    console.log('✅ Health check passed:', healthResponse);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: AirLabs API through proxy
  console.log('\n2. Testing AirLabs API through proxy...');
  const testParams = new URLSearchParams({
    api_key: AIRLABS_API_KEY,
    dep_iata: 'ZRH',
    arr_iata: 'NRT',
    limit: '5'
  });

  try {
    const apiResponse = await makeRequest(`${PROXY_URL}/api/airlabs/routes?${testParams}`);
    console.log('✅ AirLabs API test passed');
    console.log(`   Found ${apiResponse.response?.length || 0} routes`);
    console.log(`   Total items: ${apiResponse.total_items || 0}`);
    
    if (apiResponse.response && apiResponse.response.length > 0) {
      const firstRoute = apiResponse.response[0];
      console.log(`   Sample route: ${firstRoute.airline_iata} ${firstRoute.flight_number}`);
    }
  } catch (error) {
    console.log('❌ AirLabs API test failed:', error.message);
  }

  // Test 3: Farera flight search (optional)
  if (FARERA_API_KEY && FARERA_PARTNER_META) {
    console.log('\n3. Testing Farera flight search proxy...');
    const fareraPayload = {
      currency: 'EUR',
      language: 'en-US',
      adults: 1,
      legs: [
        { origin: 'ZRH', destination: 'NRT', date: '2025-05-01' }
      ]
    };

    try {
      const fareraResponse = await makePostRequest(
        `${PROXY_URL}/api/search/${encodeURIComponent(FARERA_PARTNER_META)}`,
        fareraPayload,
        {
          'Content-Type': 'application/json',
        }
      );
      console.log('✅ Farera test passed');
      console.log(`   Solutions returned: ${fareraResponse.solutions?.length || 0}`);
    } catch (error) {
      console.log('❌ Farera test failed:', error.message);
    }
  } else {
    console.log('\nℹ️  Skipping Farera test (set FARERA_API_KEY and FARERA_PARTNER_META to enable)');
  }

  console.log('\n🎉 Proxy testing complete!');
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(jsonData);
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${jsonData.message || data}`));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${parseError.message}`));
        }
      });
    });
    
    request.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });
    
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function makePostRequest(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }, (response) => {
      let data = '';

      response.on('data', chunk => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const jsonData = JSON.parse(data || '{}');
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(jsonData);
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${jsonData.message || data}`));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${parseError.message}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });

    request.write(JSON.stringify(body ?? {}));
    request.end();
  });
}

// Run the test
if (require.main === module) {
  testProxy().catch(console.error);
}

module.exports = { testProxy };
