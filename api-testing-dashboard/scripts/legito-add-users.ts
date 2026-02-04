/**
 * Script to add users from Excel file to Legito Workspace
 * Uses Daniel Benitez's permissions as a template for new users
 *
 * Usage: npx tsx scripts/legito-add-users.ts
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://tmf.legito.com/api/v7',
  API_KEY: '2398dfe0-1080-4628-be8f-b0e3953b3f28',
  API_SECRET: 'e3bf8636-7aaf-4043-b68c-f9b206d9d2d3',
  EXCEL_FILE: path.join(__dirname, '../../docs/LEGITO Spain GEM users 27012026.xlsx'),
  OUTPUT_DIR: path.join(__dirname, '../data'),
  REFERENCE_USER: 'daniel benitez', // case-insensitive search
};

// Types
interface ExcelUser {
  nombre: string;
  tmfId: string; // email
  office: string;
}

interface LegitoUser {
  id: number;
  email: string;
  name: string;
  customIdentifier?: string;
  position?: string;
  timezone?: string;
}

interface Permission {
  admin?: boolean;
  viewConfidential?: boolean;
  autoShare?: string;
  download?: boolean;
  downloadDocx?: boolean;
  downloadPdf?: boolean;
  downloadPdfa?: boolean;
  downloadHtml?: boolean;
  downloadHtm?: boolean;
  downloadRtf?: boolean;
  downloadXml?: boolean;
  downloadOdt?: boolean;
  downloadTxt?: boolean;
  downloadWithView?: boolean;
  templateSuitesAll?: string;
  templateSuitesList?: { id: number; permission: string }[];
  templateSuitesCategoriesAll?: string;
  templateSuitesCategoriesList?: { id: number; permission: string }[];
  templateSuitesCountriesAll?: string;
  templateSuitesCountriesList?: { id: number; permission: string }[];
  createTemplateSuite?: boolean;
  clausesLibraryAll?: boolean;
  clausesLibraryList?: number[];
  clausesLibraryCategoriesAll?: boolean;
  clausesLibraryCategoriesList?: number[];
  clausesLibraryCountriesAll?: boolean;
  clausesLibraryCountriesList?: number[];
  accessClausesLibrary?: boolean;
  createDocumentRecord?: boolean;
  createLabel?: boolean;
  changeLang?: boolean;
  userList?: string;
  uploadFiles?: boolean;
  viewAnalytics?: boolean;
  manageStyles?: boolean;
  manageAdvancedStyles?: boolean;
  shareLinkTemplate?: boolean;
  shareLinkDocument?: boolean;
  viewInternalDocument?: boolean;
  emailDocument?: boolean;
  modifyTextElements?: boolean;
  manageTags?: boolean;
  manageScripts?: boolean;
  manageObjects?: boolean;
  manageWorkflow?: boolean;
  manageJsonIntegration?: boolean;
  manageLegitoSign?: boolean;
  signLegitoBiosign?: boolean;
  signDocusign?: boolean;
  signAdobeSign?: boolean;
  signFlowSign?: boolean;
  signLegitoSign?: boolean;
  timelineView?: boolean;
  timelineIncognito?: boolean;
  kanbanView?: boolean;
  trackChangesDisplay?: boolean;
  trackChangesControl?: boolean;
  trackChangesApprove?: boolean;
  objectsAll?: string;
  objectsList?: { id: number; permission: string }[];
}

interface Report {
  timestamp: string;
  referenceUser: string;
  referencePermissions: Permission | null;
  usersCreated: { name: string; email: string }[];
  usersSkipped: { name: string; email: string; reason: string }[];
  errors: { name: string; email: string; error: string }[];
}

// JWT Token Generation
function generateJWT(): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: CONFIG.API_KEY,
    iat: now,
    exp: now + 3600,
  };

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

// API Client
async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: unknown,
  silent = false
): Promise<T> {
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

  if (!silent) {
    console.log(`  → ${method} ${endpoint}`);
  }
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// API Client with retry for permission setting
async function setPermissionsWithRetry(
  email: string,
  permissions: Permission,
  maxRetries = 3,
  delayMs = 2000
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await apiRequest<unknown>('PUT', `/user/permission/${encodeURIComponent(email)}`, permissions, true);
      console.log(`    ✓ Permissions set (attempt ${attempt})`);
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (attempt < maxRetries && msg.includes('404')) {
        console.log(`    ⏳ User not yet available, retrying in ${delayMs}ms... (${attempt}/${maxRetries})`);
        await sleep(delayMs);
      } else {
        throw error;
      }
    }
  }
}

// Read Excel File
function readExcelFile(): ExcelUser[] {
  console.log(`\nReading Excel file: ${CONFIG.EXCEL_FILE}`);

  if (!fs.existsSync(CONFIG.EXCEL_FILE)) {
    throw new Error(`Excel file not found: ${CONFIG.EXCEL_FILE}`);
  }

  const workbook = XLSX.readFile(CONFIG.EXCEL_FILE);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON with header row
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  console.log(`  Found ${data.length} rows in sheet "${sheetName}"`);
  console.log(`  Column names: ${Object.keys(data[0] || {}).join(', ')}`);

  // Map columns (case-insensitive matching)
  const users: ExcelUser[] = data.map((row, index) => {
    // Find columns by partial match
    const keys = Object.keys(row);
    const nombreKey = keys.find(k => k.toLowerCase().includes('nombre')) || keys[0];
    const tmfIdKey = keys.find(k => k.toLowerCase().includes('tmf') || k.toLowerCase().includes('id')) || keys[1];
    const officeKey = keys.find(k => k.toLowerCase().includes('office')) || keys[2];

    const user: ExcelUser = {
      nombre: String(row[nombreKey] || '').trim(),
      tmfId: String(row[tmfIdKey] || '').trim(),
      office: String(row[officeKey] || '').trim(),
    };

    if (!user.nombre || !user.tmfId) {
      console.warn(`  Warning: Row ${index + 2} missing name or email: ${JSON.stringify(row)}`);
    }

    return user;
  }).filter(u => u.nombre && u.tmfId);

  console.log(`  Parsed ${users.length} valid users`);
  return users;
}

// Main Script
async function main() {
  console.log('='.repeat(60));
  console.log('Legito User Import Script');
  console.log('='.repeat(60));

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  const report: Report = {
    timestamp: new Date().toISOString(),
    referenceUser: CONFIG.REFERENCE_USER,
    referencePermissions: null,
    usersCreated: [],
    usersSkipped: [],
    errors: [],
  };

  try {
    // Step 1: Test API Connection
    console.log('\n[Step 1] Testing API connection...');
    const info = await apiRequest<{ version: string }>('GET', '/info');
    console.log(`  ✓ Connected to Legito API v${info.version || 'unknown'}`);

    // Step 2: Get all users and find Daniel Benitez
    console.log('\n[Step 2] Finding reference user (Daniel Benitez)...');
    const users = await apiRequest<LegitoUser[]>('GET', '/user');
    console.log(`  Found ${users.length} users in workspace`);

    const danielUser = users.find(u =>
      u.name.toLowerCase().includes(CONFIG.REFERENCE_USER.toLowerCase())
    );

    if (!danielUser) {
      throw new Error(`Reference user "${CONFIG.REFERENCE_USER}" not found`);
    }

    console.log(`  ✓ Found: ${danielUser.name} (${danielUser.email})`);

    // Get Daniel's permissions
    console.log('\n[Step 2b] Getting Daniel Benitez\'s permissions...');
    const permissions = await apiRequest<Permission>('GET', `/user/permission/${encodeURIComponent(danielUser.email)}`);
    report.referencePermissions = permissions;

    // Save permissions to file for reference
    const permissionsFile = path.join(CONFIG.OUTPUT_DIR, 'daniel-benitez-permissions.json');
    fs.writeFileSync(permissionsFile, JSON.stringify(permissions, null, 2));
    console.log(`  ✓ Permissions saved to: ${permissionsFile}`);
    console.log(`  Key permissions: admin=${permissions.admin}, templateSuitesAll=${permissions.templateSuitesAll}`);

    // Step 3: Create set of existing emails (normalized to lowercase)
    console.log('\n[Step 3] Building existing users list...');
    const existingEmails = new Set(users.map(u => u.email.toLowerCase()));
    console.log(`  ${existingEmails.size} unique emails in workspace`);

    // Step 4: Read Excel and add new users
    console.log('\n[Step 4] Processing Excel users...');
    const excelUsers = readExcelFile();

    console.log('\n[Step 5] Adding new users...');
    for (const excelUser of excelUsers) {
      const email = excelUser.tmfId.toLowerCase();
      const name = excelUser.nombre;

      console.log(`\n  Processing: ${name} (${excelUser.tmfId})`);

      // Check if user already exists
      if (existingEmails.has(email)) {
        console.log(`    → SKIP: User already exists`);
        report.usersSkipped.push({ name, email: excelUser.tmfId, reason: 'Already exists' });
        continue;
      }

      try {
        // Create user - API expects an ARRAY of users
        console.log(`    → Creating user...`);
        const newUserArray = [{
          email: excelUser.tmfId, // Use original case from Excel
          name: name,
        }];

        const createdUsers = await apiRequest<LegitoUser[]>('POST', '/user', newUserArray);
        const createdUser = createdUsers?.[0];
        console.log(`    ✓ User created (id: ${createdUser?.id || 'unknown'})`);

        // Set permissions with retry (API may need time to propagate user)
        console.log(`    → Setting permissions...`);
        await setPermissionsWithRetry(excelUser.tmfId, permissions);

        report.usersCreated.push({ name, email: excelUser.tmfId });
        existingEmails.add(email); // Prevent duplicates within Excel file
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`    ✗ ERROR: ${errorMessage}`);
        report.errors.push({ name, email: excelUser.tmfId, error: errorMessage });
      }
    }

    // Step 6: Generate Report
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY REPORT');
    console.log('='.repeat(60));
    console.log(`\nTimestamp: ${report.timestamp}`);
    console.log(`Reference User: ${report.referenceUser}`);
    console.log(`\nUsers Created: ${report.usersCreated.length}`);
    report.usersCreated.forEach(u => console.log(`  ✓ ${u.name} (${u.email})`));

    console.log(`\nUsers Skipped: ${report.usersSkipped.length}`);
    report.usersSkipped.forEach(u => console.log(`  - ${u.name} (${u.email}) - ${u.reason}`));

    console.log(`\nErrors: ${report.errors.length}`);
    report.errors.forEach(u => console.log(`  ✗ ${u.name} (${u.email}) - ${u.error}`));

    // Save full report
    const reportFile = path.join(CONFIG.OUTPUT_DIR, `user-import-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\nFull report saved to: ${reportFile}`);

  } catch (error) {
    console.error('\n✗ FATAL ERROR:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
