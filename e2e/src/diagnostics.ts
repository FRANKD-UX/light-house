export const remedies = {
  APPROVED_TARGET_REQUIRED:
    'The exact owner-approved DEVELOPMENT target is missing or unsafe. Restore private e2e/.local/approved-target.json with directory0700/file0600 through the owner-approved process; do not guess a target or inspect session contents.',
  BROWSER_CHANNEL_INVALID:
    'Set LIGHT_HOUSE_E2E_BROWSER_CHANNEL to chrome (installed Google Chrome Stable, default) or chromium (Playwright-managed Chromium). No fallback is attempted.',
  BROWSER_ROOT_DENIED:
    'Run browser commands as your normal non-root desktop user. Root browser execution is prohibited.',
  BROWSER_LAUNCH_FAILED:
    'Run the terminal as your normal desktop user. Use installed Google Chrome Stable with LIGHT_HOUSE_E2E_BROWSER_CHANNEL=chrome on this Ubuntu workstation; do not use sudo, disable the sandbox, or change AppArmor/kernel settings. Rerun test:e2e:doctor.',
  DISPLAY_UNAVAILABLE:
    'Open a terminal inside your logged-in Ubuntu graphical desktop and rerun test:e2e:doctor there. SSH, containers and headless terminals may lack display access. Do not invent DISPLAY values; Wayland desktops need working XWayland for this Chromium launch.',
  BROWSER_DEPENDENCIES_MISSING:
    'On Ubuntu run npm exec --prefix e2e -- playwright install-deps chromium, approve OS package installation locally, then rerun test:e2e:doctor. Downloading Chromium alone does not install system libraries.',
  BROWSER_EXECUTABLE_MISSING:
    'For channel chrome, install Google Chrome Stable using your approved workstation process. For channel chromium, run npm exec --prefix e2e -- playwright install chromium as the same user and match PLAYWRIGHT_BROWSERS_PATH at install/run. No channel fallback is attempted.',
  SESSION_DIRECTORY_FAILED:
    'Ensure e2e/.local and its auth directory can be created beneath this checkout. Resolve conflicting files or symlinks locally; do not delete an existing session blindly. Rerun test:e2e:doctor.',
  SESSION_PERMISSION_DENIED:
    'Use the checkout as its owning desktop user. Check ownership of e2e/.local and auth; directories must be owner-only (700), state.json owner-only (600). Correct ownership locally; never run authentication with sudo or make state world-readable.',
  AUTH_NAVIGATION_FAILED:
    'Check desktop network, DNS, proxy and Atlassian access in your normal browser. Rerun test:e2e:auth; do not bypass authentication or certificate controls.',
  AUTH_TIMEOUT:
    'Complete login, SSO and MFA in the opened browser within ten minutes and wait for Light House to render. Then rerun test:e2e:auth if necessary. Do not paste credentials into the terminal.',
  SESSION_SAVE_FAILED:
    'Check free disk space and writable owner-only e2e/.local/auth storage. Rerun test:e2e:doctor and then test:e2e:auth. An existing saved session is not replaced until the atomic write succeeds.',
  INTERACTIVE_TERMINAL_REQUIRED:
    'Run npm run test:e2e:auth directly in a terminal on your Ubuntu desktop, without redirected input. Complete login and MFA in the browser; no terminal credential prompt is used.',
  LOCAL_PREREQUISITE_FAILED:
    'Use Node 22.23.4 through 22.x and run npm ci --prefix e2e, then rerun test:e2e:doctor. Consult e2e/README.md.',
} as const;
export type DiagnosticCode = keyof typeof remedies;
export class DiagnosticError extends Error {
  constructor(
    readonly code: DiagnosticCode,
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}
export function diagnosticMessage(error: unknown): string {
  const code =
    error instanceof DiagnosticError
      ? error.code
      : error instanceof Error && error.message === 'APPROVED_TARGET_REQUIRED'
        ? 'APPROVED_TARGET_REQUIRED'
        : 'LOCAL_PREREQUISITE_FAILED';
  return `Light House E2E ${code}: ${remedies[code]}`;
}
// Inspect only in memory; neither original text nor causes are emitted.
export function launchCode(error: unknown): DiagnosticCode {
  const message = error instanceof Error ? error.message : '';
  if (
    /missing dependencies|error while loading shared libraries|host system is missing|cannot open shared object/i.test(
      message,
    )
  )
    return 'BROWSER_DEPENDENCIES_MISSING';
  if (
    /missing X server|\$DISPLAY|cannot open display|failed to open.*display|Could not connect.*display/i.test(
      message,
    )
  )
    return 'DISPLAY_UNAVAILABLE';
  if (
    /executable doesn't exist|(?:chrome|chromium).*not found|ENOENT.*(?:chrome|chromium)/i.test(
      message,
    )
  )
    return 'BROWSER_EXECUTABLE_MISSING';
  return 'BROWSER_LAUNCH_FAILED';
}
export function storageCode(error: unknown, saving = false): DiagnosticCode {
  const code =
    error instanceof Error && 'code' in error ? error.code : undefined;
  if (
    code === 'EACCES' ||
    code === 'EPERM' ||
    code === 'ELOOP' ||
    (error instanceof Error && /UNSAFE_PRIVATE|PATH_DENIED/.test(error.message))
  )
    return 'SESSION_PERMISSION_DENIED';
  return saving ? 'SESSION_SAVE_FAILED' : 'SESSION_DIRECTORY_FAILED';
}
export async function stage<T>(
  code: DiagnosticCode,
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new DiagnosticError(code, error);
  }
}
