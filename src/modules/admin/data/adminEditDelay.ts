export const ADMIN_EDIT_DELAY_MS = 2000
export const ADMIN_DELETE_DELAY_MS = 3000

/** Keeps admin edit feedback visible long enough to clearly register. */
export function waitForAdminEditDelay(
  delayMs = ADMIN_EDIT_DELAY_MS,
): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs))
}

/** Adds a safety window before an admin deletion reaches the database. */
export function waitForAdminDeleteDelay(
  delayMs = ADMIN_DELETE_DELAY_MS,
): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs))
}
