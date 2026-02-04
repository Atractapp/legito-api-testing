/**
 * Test script to add ONE user and verify permissions
 *
 * Usage: npx tsx scripts/legito-test-one-user.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://tmf.legito.com/api/v7',
  API_KEY: '2398dfe0-1080-4628-be8f-b0e3953b3f28',
  API_SECRET: 'e3bf8636-7aaf-4043-b68c-f9b206d9d2d3',
  OUTPUT_DIR: path.join(__dirname, '../data'),
  // Test user - first from the Excel list
  TEST_USER: {
    name: 'Aina Miquel Canadell',
    email: 'aina.miquelcanadell@tmf-group.com',
  },
  REFERENCE_USER: 'daniel benitez',
};

interface LegitoUser {
  id: number;
  email: string;
  name: string;
}

interface Permission {
  [key: string]: unknown;
}

// JWT Token Generation
function generateJWT(): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: CONFIG.API_KEY, iat: now, exp: now + 3600 };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', CONFIG.API_SECRET)
    .update(`${base64Header}.${base64Payload}`)
    .digest('base64url');
  return `${base64Header}.${base64Payload}.${signature}`;
}

// Utility: sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// API Client with full response logging
async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: unknown
): Promise<{ status: number; data: unknown; ok: boolean }> {
  const token = generateJWT();
  const url = `${CONFIG.API_BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`\n→ ${method} ${endpoint}`);
  if (body) {
    console.log(`  Request body: ${JSON.stringify(body, null, 2)}`);
  }

  const response = await fetch(url, options);
  const responseText = await response.text();

  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }

  console.log(`  Status: ${response.status}`);
  console.log(`  Response: ${JSON.stringify(data, null, 2)}`);

  return { status: response.status, data, ok: response.ok };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Legito Single User Test');
  console.log('='.repeat(60));

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  // Step 1: Test API Connection
  console.log('\n[Step 1] Testing API connection...');
  const infoResult = await apiRequest('GET', '/info');
  if (!infoResult.ok) {
    throw new Error('API connection failed');
  }
  console.log('✓ API connected');

  // Step 2: Get Daniel Benitez's permissions
  console.log('\n[Step 2] Getting Daniel Benitez\'s permissions...');
  const usersResult = await apiRequest('GET', '/user');
  const users = usersResult.data as LegitoUser[];

  const danielUser = users.find(u =>
    u.name.toLowerCase().includes(CONFIG.REFERENCE_USER.toLowerCase())
  );

  if (!danielUser) {
    throw new Error('Daniel Benitez not found');
  }

  console.log(`\n✓ Found Daniel: ${danielUser.name} (id: ${danielUser.id})`);

  const permResult = await apiRequest('GET', `/user/permission/${encodeURIComponent(danielUser.email)}`);
  const permissions = permResult.data as Permission;

  // Save permissions
  fs.writeFileSync(
    path.join(CONFIG.OUTPUT_DIR, 'daniel-permissions.json'),
    JSON.stringify(permissions, null, 2)
  );

  // Step 3: Check if test user already exists
  console.log('\n[Step 3] Checking if test user exists...');
  const existingUser = users.find(u =>
    u.email.toLowerCase() === CONFIG.TEST_USER.email.toLowerCase()
  );

  if (existingUser) {
    console.log(`\n⚠ Test user already exists with id ${existingUser.id}`);
    console.log('Checking their permissions...');

    const existingPermResult = await apiRequest('GET', `/user/permission/${encodeURIComponent(existingUser.email)}`);

    // Compare permissions
    const existingPerms = existingPermResult.data as Permission;
    console.log('\n--- Permission comparison ---');
    console.log('Daniel has admin:', permissions.admin);
    console.log('Test user has admin:', existingPerms.admin);
    console.log('Daniel templateSuitesAll:', permissions.templateSuitesAll);
    console.log('Test user templateSuitesAll:', existingPerms.templateSuitesAll);

    return;
  }

  // Step 4: Create test user
  // NOTE: API expects an ARRAY of users, not a single object
  console.log('\n[Step 4] Creating test user...');
  const createResult = await apiRequest('POST', '/user', [
    {
      email: CONFIG.TEST_USER.email,
      name: CONFIG.TEST_USER.name,
    }
  ]);

  if (!createResult.ok) {
    console.error('Failed to create user');
    return;
  }

  console.log('✓ User created');

  // Step 5: Wait and verify user exists
  console.log('\n[Step 5] Waiting for user to propagate...');
  await sleep(3000);

  // Refresh user list
  const usersResult2 = await apiRequest('GET', '/user');
  const users2 = usersResult2.data as LegitoUser[];
  const newUser = users2.find(u =>
    u.email.toLowerCase() === CONFIG.TEST_USER.email.toLowerCase()
  );

  if (!newUser) {
    console.error('❌ User was created but not found in user list!');
    return;
  }

  console.log(`✓ User found in list with id ${newUser.id}`);

  // Step 6: Set permissions
  console.log('\n[Step 6] Setting permissions...');
  const setPermResult = await apiRequest('PUT', `/user/permission/${encodeURIComponent(CONFIG.TEST_USER.email)}`, permissions);

  if (!setPermResult.ok) {
    console.error('Failed to set permissions');
    return;
  }

  console.log('✓ Permissions set');

  // Step 7: Verify permissions
  console.log('\n[Step 7] Verifying permissions...');
  const verifyPermResult = await apiRequest('GET', `/user/permission/${encodeURIComponent(CONFIG.TEST_USER.email)}`);
  const newPerms = verifyPermResult.data as Permission;

  console.log('\n--- Permission verification ---');
  console.log('Daniel has admin:', permissions.admin);
  console.log('New user has admin:', newPerms.admin);
  console.log('Daniel templateSuitesAll:', permissions.templateSuitesAll);
  console.log('New user templateSuitesAll:', newPerms.templateSuitesAll);

  // Check if they match
  const keysToCheck = ['admin', 'templateSuitesAll', 'createDocumentRecord', 'viewConfidential'];
  let allMatch = true;
  for (const key of keysToCheck) {
    if (permissions[key] !== newPerms[key]) {
      console.log(`❌ Mismatch on ${key}: Daniel=${permissions[key]}, NewUser=${newPerms[key]}`);
      allMatch = false;
    }
  }

  if (allMatch) {
    console.log('\n✓ All checked permissions match!');
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
