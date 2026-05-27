const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to Oracle Fusion Cloud...');
  await page.goto('https://eqjz.ds-fa.oraclepdemos.com/hcmUI/faces/FuseWelcome?fndThemeName=Vision_Default');

  console.log('Waiting for login fields...');
  // Oracle often has dynamic IDs or requires waiting
  await page.waitForSelector('[name="userid"]', { timeout: 15000 }).catch(() => null); // Common IDCS
  await page.waitForSelector('#userid', { timeout: 15000 }).catch(() => null); 

  console.log('Attempting login...');
  // Let's try common locators for Oracle SSO
  try {
    await page.fill('input[type="text"], input[name="userid"], #userid, #username', 'hcm_impl');
    await page.fill('input[type="password"]', 'U2*t4%zn');
    await page.click('button[type="submit"], input[type="submit"], #btnActive');
    
    console.log('Login submitted, waiting for navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
    console.log('Login successful! Current URL:', page.url());
  } catch (e) {
    console.error('Failed during login flow:', e);
  }

  await browser.close();
})();
