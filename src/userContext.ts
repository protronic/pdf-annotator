/**
 * Signed-in OpenCloud user, used as the PDF annotation /T author.
 *
 * Filled by index.ts from the OpenCloud user store when the extension is
 * registered; stays empty outside the OpenCloud runtime (e.g. in the test
 * harness). Kept in its own module so App.vue does not need to import
 * @opencloud-eu/web-pkg, which only exists as a shared module inside the
 * OpenCloud host.
 */
export const userContext = {
  displayName: '',
  userName: '',
  id: '',
};

/** Value written to the PDF annotation /T field and shown in the sidebar. */
export function annotationAuthor(): string {
  const name = userContext.displayName.trim();
  const ref = (userContext.userName || userContext.id).trim();
  if (name && ref && name.toLowerCase() !== ref.toLowerCase()) {
    return `${name} (${ref})`;
  }
  return name || ref;
}
