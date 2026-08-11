/**
 * Display name of the signed-in OpenCloud user.
 *
 * Filled by index.ts from the OpenCloud user store when the extension is
 * registered; stays empty outside the OpenCloud runtime (e.g. in the test
 * harness). Kept in its own module so App.vue does not need to import
 * @opencloud-eu/web-pkg, which only exists as a shared module inside the
 * OpenCloud host.
 */
export const userContext = {
  displayName: '',
};
