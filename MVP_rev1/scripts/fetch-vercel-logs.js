/**
 * Fetch Vercel Logs via API
 * 
 * This script uses the Vercel API to fetch logs and extract questions.
 * Much easier than trying to copy from the dashboard!
 */

const https = require('https');

// Configuration
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || '';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const DEPLOYMENT_URL = process.argv[2] || 'weleap-mvp.vercel.app';
const OUTPUT_FILE = process.argv[3] || 'vercel-logs.txt';

if (!VERCEL_TOKEN) {
  console.error('❌ Error: VERCEL_TOKEN environment variable is required');
  console.error('\nTo get your token:');
  console.error('1. Go to https://vercel.com/account/tokens');
  console.error('2. Create a new token');
  console.error('3. Run: export VERCEL_TOKEN=your-token-here');
  console.error('\nOr use vercel CLI token:');
  console.error('  cat ~/.vercel/auth.json | grep token');
  process.exit(1);
}

async function fetchLogs() {
  try {
    console.log(`📥 Fetching logs for: ${DEPLOYMENT_URL}`);
    console.log('   (This may take a moment...)\n');

    // Get deployment ID from URL
    const deploymentId = await getDeploymentId(DEPLOYMENT_URL);
    
    if (!deploymentId) {
      console.error(`❌ Could not find deployment for: ${DEPLOYMENT_URL}`);
      console.error('\nAvailable options:');
      console.error('1. Use a specific deployment ID instead of URL');
      console.error('2. Check the URL is correct');
      process.exit(1);
    }

    console.log(`✅ Found deployment: ${deploymentId}\n`);

    // Fetch logs
    const logs = await getDeploymentLogs(deploymentId);
    
    if (logs.length === 0) {
      console.log('⚠️  No logs found for this deployment');
      console.log('   This could mean:');
      console.log('   - The deployment is too old (logs are only kept for 7-30 days)');
      console.log('   - No requests have been made yet');
      return;
    }

    // Save to file
    const fs = require('fs');
    fs.writeFileSync(OUTPUT_FILE, logs.join('\n'));
    
    console.log(`✅ Saved ${logs.length} log lines to: ${OUTPUT_FILE}`);
    console.log(`\n📊 Next step: Extract questions with:`);
    console.log(`   node scripts/extract-questions.js --input ${OUTPUT_FILE} --format csv --output questions.csv`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function getDeploymentId(urlOrId) {
  // If it looks like a deployment ID, return it
  if (urlOrId.startsWith('dpl_')) {
    return urlOrId;
  }

  // Otherwise, search for deployment by URL
  const url = new URL(urlOrId.startsWith('http') ? urlOrId : `https://${urlOrId}`);
  const hostname = url.hostname.replace('.vercel.app', '');

  try {
    const deployments = await apiRequest(`/v13/deployments?limit=100`);
    
    for (const deployment of deployments.deployments || []) {
      if (deployment.url && deployment.url.includes(hostname)) {
        return deployment.uid;
      }
      // Also check alias
      if (deployment.alias && deployment.alias.some(a => a.includes(hostname))) {
        return deployment.uid;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching deployments:', error.message);
    return null;
  }
}

async function getDeploymentLogs(deploymentId) {
  try {
    // Vercel API endpoint for logs
    const endpoint = `/v2/deployments/${deploymentId}/events`;
    const events = await apiRequest(endpoint);
    
    // Convert events to log format
    const logs = [];
    
    // Get all log events
    for (const event of events || []) {
      if (event.type === 'log' && event.payload) {
        const payload = typeof event.payload === 'string' 
          ? JSON.parse(event.payload) 
          : event.payload;
        
        // Format like Vercel logs
        const timestamp = new Date(event.created).toISOString();
        const level = payload.level || 'info';
        const message = payload.message || JSON.stringify(payload);
        
        logs.push(`[${timestamp}] [${level}] ${message}`);
      }
    }
    
    return logs;
  } catch (error) {
    // If the events endpoint doesn't work, try alternative
    console.warn('⚠️  Events endpoint not available, trying alternative method...');
    throw error;
  }
}

function apiRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      path: path + (path.includes('?') ? '&' : '?') + (VERCEL_TEAM_ID ? `teamId=${VERCEL_TEAM_ID}&` : ''),
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`API error ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Run
fetchLogs();

