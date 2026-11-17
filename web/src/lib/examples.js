// Per-tool example values, curated for the mock catalog's illustrative sample. Ideas 4 and 5:
// a field with an examples entry shows click-to-fill chips under it; the tools list deep-links
// with required fields pre-filled. Examples are SUGGESTIONS ONLY: they are visible in the wire
// view before the call and the confirm dialog repeats them for write and destructive tools.
// Values are fake (example.invalid, well-formed UUIDs) — never real tenant data.
const uuid = (n) => `${n}1111111-2222-4333-8444-555555555555`.slice(0, 36);

export const EXAMPLES = {
  environmentId: ["sample-env-1234"],
  applicationId: [uuid("a")],
  populationId: [uuid("p")],
  userId: [uuid("u"), "sample.user"],
  username: ["sample.user"],
  email: ["sample.user@example.invalid"],
  name: ["Sample Application", "Sample User"],
  filter: ["sample"],
  query: ["sample"],
  type: ["WEB_APP", "NATIVE_APP", "SERVICE", "WORKER"],
  groupId: [uuid("g")],
  enabled: ["true", "false"],
};

// Tool → arguments pre-fill for the tools-list "Try it" deep link (idea 5). Only required
// fields get example values; the user sees and edits them before calling, and writes still
// go through the confirm dialog.
export const TRY_IT_DEFAULTS = {
  listApplications: { environmentId: "sample-env-1234" },
  getApplication: { environmentId: "sample-env-1234", applicationId: uuid("a") },
  listPopulations: { environmentId: "sample-env-1234" },
  listUsers: { environmentId: "sample-env-1234", filter: "sample" },
  getUser: { environmentId: "sample-env-1234", userId: uuid("u") },
  searchUsers: { environmentId: "sample-env-1234", query: "sample" },
  listDaVinciFlows: { environmentId: "sample-env-1234" },
  describeEnvironment: { environmentId: "sample-env-1234" },
  createApplication: { environmentId: "sample-env-1234", name: "Sample Application", type: "WEB_APP" },
  updateApplication: { environmentId: "sample-env-1234", applicationId: uuid("a"), name: "Sample Application" },
  createUser: { environmentId: "sample-env-1234", username: "sample.user", email: "sample.user@example.invalid", populationId: uuid("p") },
  updateUser: { environmentId: "sample-env-1234", userId: uuid("u"), email: "sample.user@example.invalid" },
  enableUser: { environmentId: "sample-env-1234", userId: uuid("u") },
  disableUser: { environmentId: "sample-env-1234", userId: uuid("u") },
  resetUserPassword: { environmentId: "sample-env-1234", userId: uuid("u") },
  unlockUser: { environmentId: "sample-env-1234", userId: uuid("u") },
  assignUserToGroup: { environmentId: "sample-env-1234", userId: uuid("u"), groupId: uuid("g") },
  deleteUser: { environmentId: "sample-env-1234", userId: uuid("u") },
  deleteApplication: { environmentId: "sample-env-1234", applicationId: uuid("a") },
  purgeUserData: { environmentId: "sample-env-1234", userId: uuid("u") },
};

export const examplesFor = (field) => EXAMPLES[field] || [];
export const tryItDefaults = (toolName) => TRY_IT_DEFAULTS[toolName] || null;
