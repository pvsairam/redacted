# Trim Initial Loading Delay from Video (Two-Context Replay Flow)

This plan outlines the implementation of a Two-Context Replay Flow to completely eliminate initial website connection and redirect loading delays (typically 8–10 seconds) from the final recorded video.

## User Review Required

> [!IMPORTANT]
> **Key Change:** The runner will perform the initial website load and session negotiation in a temporary, unrecorded browser context. Once the login page is fully loaded, the runner will transfer the session cookies to a new, recorded context and load the sign-in page instantly. The recorded video will begin directly with the sign-in page fully rendered.

## Proposed Changes

### `packages/playwright-engine`

#### [MODIFY] [runner.ts](file:///c:/Users/pvsai/redacted/packages/playwright-engine/src/runner.ts)
- Modify `replayTestCase` to:
  1. Determine the initial navigate URL (resolving environment overrides).
  2. Launch a temporary, unrecorded browser context to navigate to the initial URL.
  3. Wait for the page to load completely (resolving IDCS SSO redirect loop).
  4. Extract cookies and the final landed URL from the temporary context.
  5. Close the temporary context.
  6. Launch the main context with video recording enabled and inject the extracted cookies.
  7. Open the page in the main context and navigate instantly to the landed URL.
  8. Capture the Step 1 screenshot on the main context.
  9. Run the remaining steps (clicks, typing, etc.) inside the main context.

## Verification Plan

### Automated Tests
- Run `pnpm --filter @qa-platform/playwright-engine build` to ensure typescript compilation is successful.
- Trigger a test run using `runTest.ps1` and verify that the run completes successfully.

### Manual Verification
- Review the generated video file to confirm it starts directly on the loaded login page with zero blank white/dark frames.
