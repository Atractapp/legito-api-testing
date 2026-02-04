/**
 * SSO Test Logic using Playwright CDP to Browserless
 */

import { chromium, Browser, Page } from 'playwright-core';

export interface SsoTestRequest {
  testId: string;
  serverId: string;
  serverUrl: string;
}

export interface SsoTestResult {
  success: boolean;
  durationMs: number;
  errorMessage?: string;
  errorType?: string;
  screenshotBase64?: string;
}

/**
 * Get Browserless connection configuration
 */
function getBrowserlessConfig() {
  const endpoint = process.env.BROWSER_PLAYWRIGHT_ENDPOINT;
  const token = process.env.BROWSER_TOKEN;

  if (!endpoint) {
    throw new Error('BROWSER_PLAYWRIGHT_ENDPOINT not configured');
  }

  // Build WebSocket URL with token if provided
  let wsUrl = endpoint;
  if (token) {
    const url = new URL(endpoint);
    url.searchParams.set('token', token);
    wsUrl = url.toString();
  }

  return { wsUrl };
}

/**
 * Run SSO login test for a specific server
 */
export async function runSsoTest(request: SsoTestRequest): Promise<SsoTestResult> {
  const startTime = Date.now();
  let browser: Browser | null = null;
  let page: Page | null = null;

  const testEmail = process.env.SSO_TEST_EMAIL;
  const testPassword = process.env.SSO_TEST_PASSWORD;

  if (!testEmail || !testPassword) {
    return {
      success: false,
      durationMs: Date.now() - startTime,
      errorMessage: 'SSO credentials not configured',
      errorType: 'config_error',
    };
  }

  try {
    console.log(`[SSO Test] Starting test for ${request.serverId} (${request.serverUrl})`);

    // Connect to Browserless via CDP
    const { wsUrl } = getBrowserlessConfig();
    console.log(`[SSO Test] Connecting to Browserless...`);

    browser = await chromium.connectOverCDP(wsUrl, {
      timeout: 30000,
    });

    console.log(`[SSO Test] Connected to Browserless`);

    // Create new context and page
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    page = await context.newPage();

    // Set reasonable timeouts
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // Step 1: Navigate to Legito server
    console.log(`[SSO Test] Navigating to ${request.serverUrl}`);
    await page.goto(request.serverUrl, { waitUntil: 'networkidle' });

    // Step 2: Click SSO login button (if present)
    // Note: Selectors may need adjustment based on actual page structure
    console.log(`[SSO Test] Looking for SSO login button...`);

    // Try common SSO button selectors - adjust based on actual Legito login page
    const ssoButtonSelectors = [
      'button:has-text("Sign in with Microsoft")',
      'button:has-text("SSO")',
      'button:has-text("Azure")',
      'a:has-text("Sign in with Microsoft")',
      'a:has-text("SSO")',
      '[data-testid="sso-login"]',
      '.sso-login-button',
      '#sso-login',
    ];

    let ssoButtonFound = false;
    for (const selector of ssoButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 })) {
          console.log(`[SSO Test] Found SSO button with selector: ${selector}`);
          await button.click();
          ssoButtonFound = true;
          break;
        }
      } catch {
        // Continue to next selector
      }
    }

    if (!ssoButtonFound) {
      // Check if we're already on the Microsoft login page (direct SSO redirect)
      const currentUrl = page.url();
      if (!currentUrl.includes('microsoftonline.com') && !currentUrl.includes('login.microsoft.com')) {
        // Take screenshot for debugging
        const screenshot = await page.screenshot({ type: 'png' });

        return {
          success: false,
          durationMs: Date.now() - startTime,
          errorMessage: 'Could not find SSO login button. Page may have changed structure.',
          errorType: 'selector_error',
          screenshotBase64: screenshot.toString('base64'),
        };
      }
    }

    // Wait for redirect to Microsoft login
    console.log(`[SSO Test] Waiting for Microsoft login page...`);
    await page.waitForURL(/microsoftonline\.com|login\.microsoft\.com/, { timeout: 30000 });

    // Step 3: Enter email on Microsoft login page
    console.log(`[SSO Test] Entering email...`);
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', testEmail);
    await page.click('input[type="submit"]');

    // Step 4: Wait for password page and enter password
    console.log(`[SSO Test] Entering password...`);
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await page.fill('input[type="password"]', testPassword);
    await page.click('input[type="submit"]');

    // Step 5: Handle "Stay signed in?" prompt if it appears
    try {
      const staySignedInButton = page.locator('input[type="submit"][value="No"], button:has-text("No"), #idBtn_Back');
      await staySignedInButton.click({ timeout: 5000 });
      console.log(`[SSO Test] Dismissed "Stay signed in" prompt`);
    } catch {
      // Prompt might not appear, continue
      console.log(`[SSO Test] No "Stay signed in" prompt`);
    }

    // Step 6: Wait for redirect back to Legito and verify login success
    console.log(`[SSO Test] Waiting for redirect back to Legito...`);

    // Wait for URL to return to the Legito domain
    await page.waitForURL((url) => {
      const hostname = new URL(url).hostname;
      return hostname.includes('legito.com');
    }, { timeout: 60000 });

    // Verify we're logged in by checking for user-specific elements
    console.log(`[SSO Test] Verifying login success...`);

    // Look for common indicators of successful login
    // These selectors should be adjusted based on actual Legito dashboard
    const loggedInSelectors = [
      '[data-testid="user-menu"]',
      '.user-avatar',
      '.user-profile',
      'button:has-text("Logout")',
      'button:has-text("Sign out")',
      '.dashboard',
      '#dashboard',
      '[data-testid="dashboard"]',
    ];

    let loggedIn = false;
    for (const selector of loggedInSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          console.log(`[SSO Test] Login verified with selector: ${selector}`);
          loggedIn = true;
          break;
        }
      } catch {
        // Continue to next selector
      }
    }

    // If no specific logged-in indicator found, check URL doesn't contain error
    if (!loggedIn) {
      const finalUrl = page.url();
      if (finalUrl.includes('error') || finalUrl.includes('login') || finalUrl.includes('signin')) {
        const screenshot = await page.screenshot({ type: 'png' });
        return {
          success: false,
          durationMs: Date.now() - startTime,
          errorMessage: `Login may have failed. Final URL: ${finalUrl}`,
          errorType: 'login_verification_error',
          screenshotBase64: screenshot.toString('base64'),
        };
      }
      console.log(`[SSO Test] Assuming login succeeded - final URL: ${finalUrl}`);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[SSO Test] Test completed successfully in ${durationMs}ms`);

    return {
      success: true,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[SSO Test] Test failed:`, error);

    // Try to capture screenshot on error
    let screenshotBase64: string | undefined;
    if (page) {
      try {
        const screenshot = await page.screenshot({ type: 'png' });
        screenshotBase64 = screenshot.toString('base64');
      } catch {
        console.error('[SSO Test] Failed to capture error screenshot');
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let errorType = 'unknown_error';

    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      errorType = 'timeout_error';
    } else if (errorMessage.includes('navigation') || errorMessage.includes('Navigation')) {
      errorType = 'navigation_error';
    } else if (errorMessage.includes('selector') || errorMessage.includes('element')) {
      errorType = 'selector_error';
    } else if (errorMessage.includes('connect') || errorMessage.includes('Connection')) {
      errorType = 'connection_error';
    }

    return {
      success: false,
      durationMs,
      errorMessage,
      errorType,
      screenshotBase64,
    };
  } finally {
    // Cleanup
    if (browser) {
      try {
        await browser.close();
      } catch {
        console.error('[SSO Test] Error closing browser');
      }
    }
  }
}
