import { z } from "zod";
import { memberRoles } from "./member-roles";

export const createMemberInvitationSchema = z.strictObject({
  email: z.string().trim().max(254).pipe(z.email({ error: "Enter a valid email address." })),
  role: z.enum(memberRoles),
});

export const changeMemberRoleSchema = z.strictObject({ role: z.enum(memberRoles) });
