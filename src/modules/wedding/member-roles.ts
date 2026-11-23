export const memberRoles = ["ADMIN", "MANAGER"] as const;
export type MemberRole = (typeof memberRoles)[number];
export const memberRoleLabels: Record<MemberRole, string> = { ADMIN: "Admin", MANAGER: "Manager" };
