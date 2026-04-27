export const ROLES = [
  "Administrator",
  "Direktor",
  "Leitung",
  "Ermittler",
  "Agent",
  "Anwärter"
];

export const PERMISSIONS = {
  Administrator: ["read", "create", "edit", "delete", "manageUsers", "export"],
  Direktor: ["read", "create", "edit", "export"],
  Leitung: ["read", "create", "edit", "export"],
  Ermittler: ["read", "create", "edit", "export"],
  Agent: ["read", "create", "export"],
  Anwärter: ["read"]
};

export function can(role, permission) {
  return PERMISSIONS[role]?.includes(permission);
}
