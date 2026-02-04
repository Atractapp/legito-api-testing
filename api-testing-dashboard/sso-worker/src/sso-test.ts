/**
 * SSO Test Logic - Playwright via CDP to Browserless
 */

import { chromium, Browser, Page } from 'playwright-core';

export interface SsoTestConfig {
  serverUrl: string;
  email: string;
  password: string;
  browserEndpoint: string;
  browserToken?: string;
}

export interface SsoTestResult {
  success: boolean;
  durationMs: number;
  errorMessage?: string;
  errorType?: string;
  screenshotBase64?: string;
}

/**
 * Run SSO login test against a Legito server
 */
export async function runSsoTest(config: SsoTestConfig): Promise<SsoTestResult> {
  const startTime = Date.now();
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log(`[SSO Test] Starting test for ${config.serverUrl}`);

    // Connect to Browserless via CDP
    const wsEndpoint = config.browserToken
      ? `${config.browserEndpoint}?token=${config.browserToken}`
      : config.browserEndpoint;

    console.log('[SSO Test] Connecting to browser...');
    browser = await chromium.connectOverCDP(wsEndpoint, {
      timeout: 30000,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    page = await context.newPage();

    // Navigate to the Legito server
    console.log(`[SSO Test] Navigating to ${config.serverUrl}`);
    await page.goto(config.serverUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for and click the SSO login button
    console.log('[SSO Test] Looking for SSO login button...');
    const ssoButton = page.locator('button:has-text("Sign in with Microsoft"), a:has-text("Sign in with Microsoft"), [data-testid="sso-login"]');
    await ssoButton.waitFor({ state: 'visible', timeout: 10000 });
    await ssoButton.click();

    // Wait for Azure AD login page
    console.log('[SSO Test] Waiting for Azure AD login page...');
    await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15000 });

    // Enter email
    console.log('[SSO Test] Entering email...');
    const emailInput = page.locator('input[type="email"], input[name="loginfmt"]');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(config.email);
    await page.locator('input[type="submit"], button[type="submit"]').click();

    // Wait for password page
    console.log('[SSO Test] Waiting for password page...');
    await page.waitForSelector('input[type="password"], input[name="passwd"]', {
      state: 'visible',
      timeout: 15000,
    });

    // Enter password
    console.log('[SSO Test] Entering password...');
    const passwordInput = page.locator('input[type="password"], input[name="passwd"]');
    await passwordInput.fill(config.password);
    await page.locator('input[type="submit"], button[type="submit"]').click();

    // Handle "Stay signed in?" prompt if it appears
    try {
      const staySignedIn = page.locator('input[type="submit"][value="No"], button:has-text("No")');
      await staySignedIn.waitFor({ state: 'visible', timeout: 5000 });
      await staySignedIn.click();
    } catch {
      // Prompt may not appear, continue
      console.log('[SSO Test] No "Stay signed in" prompt');
    }

    // Wait for redirect back to Legito
    console.log('[SSO Test] Waiting for redirect to Legito...');
    await page.waitForURL((url) => url.hostname.includes('legito.com'), {
      timeout: 30000,
    });

    // Verify we're logged in by checking for user menu or dashboard element
    console.log('[SSO Test] Verifying login success...');
    const dashboardIndicator = page.locator(
      '[data-testid="user-menu"], .user-menu, .dashboard, [class*="Dashboard"], [class*="logged-in"]'
    );
    await dashboardIndicator.waitFor({ state: 'visible', timeout: 15000 });

    const durationMs = Date.now() - startTime;
    console.log(`[SSO Test] SUCCESS - Login completed in ${durationMs}ms`);

    return {
      success: true,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Determine error type
    let errorType = 'unknown';
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      errorType = 'timeout';
    } else if (errorMessage.includes('net::') || errorMessage.includes('Network')) {
      errorType = 'network';
    } else if (errorMessage.includes('login') || errorMessage.includes('password')) {
      errorType = 'auth_failed';
    }

    console.error(`[SSO Test] FAILED - ${errorType}: ${errorMessage}`);

    // Try to capture screenshot on failure
    let screenshotBase64: string | undefined;
    if (page) {
      try {
        const buffer = await page.screenshot({ type: 'png' });
        screenshotBase64 = buffer.toString('base64');
      } catch (screenshotError) {
        console.error('[SSO Test] Failed to capture screenshot:', screenshotError);
      }
    }

    return {
      success: false,
      durationMs,
      errorMessage,
      errorType,
      screenshotBase64,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        console.warn('[SSO Test] Failed to close browser cleanly');
      }
    }
  }
}
