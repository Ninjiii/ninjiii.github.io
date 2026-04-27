export const DEFAULT_ROLES = [
  "Administrator",
  "Director",
  "Leitung",
  "Ermittler",
  "Agent",
  "Anwärter"
];

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

export const ADMIN_PERMISSIONS = ALL_PERMISSIONS.map(permission => permission.id);

export const DEFAULT_ROLE_PERMISSIONS = {
  Administrator: ADMIN_PERMISSIONS,
  Director: ["read", "create", "edit", "createUsers", "export"],
  Direktor: ["read", "create", "edit", "createUsers", "export"],
  Leitung: ["read", "create", "edit", "export"],
  Ermittler: ["read", "create", "edit", "export"],
  Agent: ["read", "create", "export"],
  Anwärter: ["read"]
};

export function normalizeRankList(ranks) {
  const input = Array.isArray(ranks) && ranks.length
    ? ranks
    : DEFAULT_ROLES.map(name => ({
        name,
        permissions: DEFAULT_ROLE_PERMISSIONS[name] || ["read"]
      }));

  const cleaned = input.map(rank => ({
    name: rank.name,
    permissions: rank.name === "Administrator"
      ? ADMIN_PERMISSIONS
      : Array.from(new Set(rank.permissions?.length ? rank.permissions : (DEFAULT_ROLE_PERMISSIONS[rank.name] || ["read"])))
  }));

  if (!cleaned.some(rank => rank.name === "Administrator")) {
    cleaned.unshift({
      name: "Administrator",
      permissions: ADMIN_PERMISSIONS
    });
  }

  return cleaned;
}

export function permissionsFor(role, ranks) {
  if (role === "Administrator") return ADMIN_PERMISSIONS;

  const list = normalizeRankList(ranks);
  return list.find(rank => rank.name === role)?.permissions || DEFAULT_ROLE_PERMISSIONS[role] || [];
}

export function can(role, permission, ranks) {
  if (role === "Administrator") return true;
  return permissionsFor(role, ranks).includes(permission);
}
