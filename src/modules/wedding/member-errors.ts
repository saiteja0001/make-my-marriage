export const memberProblems = {
  FORBIDDEN: { status: 403, message: "Only a wedding Admin can manage members and invitations." },
  NOT_FOUND: { status: 404, message: "Wedding, member, or invitation not found." },
  LAST_ADMIN: { status: 409, message: "Your wedding must have at least one Admin. Promote another member before making this change." },
  INVALID_TOKEN: { status: 404, message: "This invitation link is invalid." },
  TOKEN_EXPIRED: { status: 410, message: "This invitation has expired. Ask a wedding Admin to send a new one." },
  INVITATION_REVOKED: { status: 410, message: "This invitation was revoked. Ask a wedding Admin if you still need access." },
  INVITATION_ALREADY_ACCEPTED: { status: 409, message: "This invitation has already been accepted." },
  ALREADY_HAS_WEDDING: { status: 409, message: "Your account already belongs to a wedding. Each account can join one wedding." },
  INVITATION_EMAIL_MISMATCH: { status: 403, message: "Sign in with the email address that received this invitation." },
  ALREADY_MEMBER: { status: 409, message: "This email already belongs to a member of your wedding." },
  INVITATION_PENDING: { status: 409, message: "There’s already a pending invitation for this email." },
  DELIVERY_FAILED: { status: 503, message: "We couldn’t send the invitation email. Please try again." },
} as const;

export class MemberError extends Error {
  constructor(public readonly code: keyof typeof memberProblems) {
    super(memberProblems[code].message);
  }
}
