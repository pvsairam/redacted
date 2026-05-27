# Browser Test Automation Platform

A complete platform to record, replay, and document web automation tests. This tool allows users to record browser actions using a Chrome extension, replay them automatically with Playwright, view live execution logs, screenshots, and videos, and generate professional Word report files.

## Project Structure

The project is structured as a monorepo managed with PNPM and Turbo.

### Applications
* **Web Dashboard (`/apps/web`)**: A Next.js application that displays test cases, real-time replay logs, screenshots, video replays, and report downloads.
* **Recorder Extension (`/apps/extension`)**: A Chrome extension built with React that records user actions and captures execution settings.
* **Backend Server (`/apps/server`)**: An Express server database-backed by Prisma (SQLite) that manages configurations, records tests, and schedules Playwright runs.

### Packages
* **Playwright Engine (`/packages/playwright-engine`)**: The playback runner that drives the browser, handles element waiting, records videos/traces, and takes step-by-step screenshots.
* **Report Generator (`/packages/report-generator`)**: A document writer that creates formatted Microsoft Word (DOCX) reports utilizing Segoe UI typography and inline screenshots.
* **Locator Utilities (`/packages/locator-utils`)**: Algorithms to generate robust CSS and XPath selectors, and identify and redact sensitive text (such as passwords and credit cards).
* **Shared Libraries (`/packages/shared`)**: Shared TypeScript interfaces, type definitions, and Zod validator schemas used across all apps.

---

## Core Capabilities

### 1. Smart Waiting for Dynamic Web Frameworks
The Playwright engine includes custom event handlers for complex enterprise platforms (such as Oracle ADF). It automatically waits for loading overlays (such as `.af_document_busy` or components with `aria-busy="true"`) to disappear before executing clicks or typing actions. This prevents tests from failing due to slow server responses.

### 2. Live Replay Log Streaming
During playback, the engine streams execution logs to the database line by line. This allows the web dashboard to show live terminal logs as the test runs, rather than waiting for the entire test case to complete.

### 3. Playwright Traces
You can toggle Playwright Trace generation on or off per test case in the extension. When enabled, the engine saves a zip trace file containing DOM snapshots, console outputs, and network calls for every step. You can download this file and open it on the official Playwright Trace Viewer at `https://trace.playwright.dev`.

### 4. PII Redaction
To protect sensitive credentials, the recorder automatically checks input field types and names (such as passwords, secret keys, credit cards, or OTP fields) and replaces their values with `[REDACTED]` before saving them to the database.

---

## Setup and Installation

Follow these steps to set up the project on your local machine or a new laptop.

### 1. Install Node.js and PNPM
* Ensure you have Node.js version 20 or newer.
* Install PNPM globally:
  ```bash
  npm install -g pnpm
  ```

### 2. Clone the Code and Install Dependencies
Run this command in the project root folder:
  ```bash
  pnpm install
  ```

### 3. Install Playwright Browsers
Install the browser binaries required by Playwright to replay tests:
  ```bash
  pnpm --filter @qa-platform/playwright-engine exec playwright install chromium
  ```

### 4. Set Up the Database
* Copy the configuration file template to a new `.env` file:
  ```bash
  # On macOS/Linux:
  cp apps/server/.env.example apps/server/.env

  # On Windows PowerShell:
  copy apps/server/.env.example apps/server/.env
  ```
* Push the database schema to your local SQLite database file and generate the Prisma Client:
  ```bash
  pnpm db:push
  ```

---

## How to Run in Development Mode

Run the following command at the project root to start the backend server and web dashboard in parallel:
```bash
pnpm dev
```
* **Web Dashboard**: Runs at `http://localhost:3000`
* **Backend Server**: Runs at `http://localhost:3001`

---

## How to Install the Chrome Extension

1. Build the extension code:
   ```bash
   pnpm --filter @qa-platform/extension build
   ```
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Choose the folder named `apps/extension/dist` inside this project.
6. The extension icon will now appear in your browser toolbar.

*Note: The backend server must be running for the extension to connect and save tests.*

---

## Testing Guidelines

### Step 1: Record a Test Case
1. Click the Chrome extension icon.
2. Enter a name for the test (for example: "Login and Navigation Test").
3. Choose your execution overrides (such as enabling video, screenshots, or Playwright Traces).
4. Click **Start Recording**.
5. Perform actions on your target website.
6. Click **Stop & Save** in the extension popup when you are finished. The test is now saved to the local database.

### Step 2: Replay the Test
1. Open the dashboard at `http://localhost:3000/tests`.
2. Select your test and click **Replay**.
3. You will be redirected to the run page where you can watch execution logs update in real time.
4. Once finished, check the status (passed or failed) and inspect screenshots under the screenshots tab.

### Step 3: Inspect Traces
1. If you enabled traces during recording, you will see a **Download Trace** button on the run page.
2. Download the `trace.zip` file.
3. Open `https://trace.playwright.dev` in your browser and upload the zip file to inspect DOM states, console warnings, and network history for each step.

### Step 4: Download the Word Report
1. Click the **Generate Report** button on a completed test run page.
2. Once generated, click **Download Report**.
3. Open the downloaded DOCX file in Microsoft Word or Google Docs to view the formatted summary, steps, and inline screenshot assets.

---

## Production Deployment

For a production environment, follow these deployment guidelines.

### 1. Database Configuration
By default, the application is configured to use a local SQLite database (`dev.db`). For high-availability production environments:
* Open `apps/server/prisma/schema.prisma`.
* Change the provider from `sqlite` to your database provider (such as `postgresql` or `mysql`).
* Update the `DATABASE_URL` connection string in `apps/server/.env` to match your database credentials. For example:
  * **SQLite (default)**: `DATABASE_URL="file:./dev.db"`
  * **PostgreSQL**: `DATABASE_URL="postgresql://username:password@localhost:5432/database_name?schema=public"`
  * **MySQL**: `DATABASE_URL="mysql://username:password@localhost:3306/database_name"`
* Generate the client and run migrations:
  ```bash
  pnpm db:migrate
  ```

### 2. Environment Configurations
Configure the following production variables in your server's `.env` file:
* `DATABASE_URL`: Your production database URL.
* `PORT`: The port for the API server (default is 3001).
* `CORS_ORIGIN`: Set this to your web dashboard domain (for example: `https://test.yourcompany.com`).
* `RUNS_STORAGE_PATH`: An absolute path to a persistent volume folder where screenshots, video files, and trace zip files will be stored.
* `DEFAULT_BROWSER`: Set the default browser for playback (default is `chromium`).
* `DEFAULT_HEADLESS`: Set to `true` to run browser tests silently on the server.

### 3. Build the Application
Run the build script to compile all TypeScript packages, bundle the Chrome extension, and generate the Next.js production build:
```bash
pnpm build
```

### 4. Process Management
To run the server in the background and ensure it restarts automatically after crashes or system reboots, use a process manager like **PM2**:
```bash
# Install PM2 globally
npm install -g pm2

# Start the Express server
pm2 start apps/server/dist/index.js --name "test-platform-api"

# Save the PM2 list to restart on reboot
pm2 save
pm2 startup
```

---

## Troubleshooting

### Refusing to Merge Unrelated Histories (on pull)
If you pull the repository on another machine and Git displays a conflict warning due to history rewrites:
1. Make sure you have no unsaved local edits.
2. Run:
   ```bash
   git fetch origin
   git reset --hard origin/main
   ```
3. Re-install and rebuild:
   ```bash
   pnpm install
   pnpm db:push
   pnpm build
   ```

### Web Dashboard Shows No Styling
If the web dashboard loads as a raw text page with a giant checkerboard background:
1. This occurs when the Next.js local bundle cache gets out of sync (usually because `pnpm dev` was running during a git pull or checkout).
2. Stop the dev server (`Ctrl + C` in your terminal).
3. Delete the Next.js cache:
   ```bash
   pnpm --filter @qa-platform/web clean
   ```
4. Start the dev server again:
   ```bash
   pnpm dev
   ```

### Deleting and Resetting Test Scripts

#### How to Delete a Single Test Case
1. Open the Web Dashboard and navigate to the **Tests** page.
2. Click on the test case you want to delete to open its detail page.
3. Click the **Delete** button in the header.
4. Confirm the deletion in the browser popup. This will automatically delete the test case and all associated runs, logs, screenshots, video files, and reports.

#### How to Clear/Reset the Entire Database
If you want to clear all test cases, runs, and reports:
1. Run the Prisma database reset command:
   ```bash
   pnpm --filter @qa-platform/server exec prisma db push --force-reset
   ```
2. Alternatively, you can manually delete the SQLite database file and recreate it:
   - Stop the backend server if it is running.
   - Delete the SQLite database file located at `apps/server/prisma/dev.db` (and `dev.db-journal` if it exists).
   - Re-initialize the database by running:
     ```bash
     pnpm db:push
     ```
   - Restart the server:
     ```bash
     pnpm dev
     ```
