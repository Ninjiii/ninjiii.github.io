export const DEFAULT_ROLES = [
  "Administrator",
  "Director",
  "Leitung",
  "Ermittler",
  "Agent",
  "Anwärter"
];

export const DEFAULT_ROLE_PERMISSIONS = {
  Administrator: ["read", "create", "edit", "delete", "manageUsers", "createUsers", "manageRanks", "export"],
  Director: ["read", "create", "edit", "createUsers", "export"],
  Leitung: ["read", "create", "edit", "export"],
  Ermittler: ["read", "create", "edit", "export"],
  Agent: ["read", "create", "export"],
  Anwärter: ["read"]
};

export const ALL_PERMISSIONS = [
  { id: "read", label: "Akten lesen" },
  { id: "create", label: "Akten erstellen" },
  { id: "edit", label: "Akten bearbeiten" },
  { id: "delete", label: "Akten löschen" },
  { id: "manageUsers", label: "Benutzer verwalten" },
  { id: "createUsers", label: "Accounts anlegen" },
  { id: "manageRanks", label: "Ränge verwalten" },
  { id: "export", label: "PDF exportieren" }
];

export function normalizeRankList(ranks) {
  if (Array.isArray(ranks) && ranks.length) return ranks;
  return DEFAULT_ROLES.map(name => ({
    name,
    permissions: DEFAULT_ROLE_PERMISSIONS[name] || ["read"]
  }));
}

export function permissionsFor(role, ranks) {
  const list = normalizeRankList(ranks);
  return list.find(rank => rank.name === role)?.permissions || [];
}

export function can(role, permission, ranks) {
  return permissionsFor(role, ranks).includes(permission);
}
