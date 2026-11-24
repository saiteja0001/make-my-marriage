import { getGuestOverview } from "@/modules/guests/service";
import { authJson } from "@/server/auth/http";
import { withGuestAccess } from "../_request";

export function GET(request: Request) {
  return withGuestAccess(request, async (weddingId) => {
    const { groups, pending, attending, declined, peopleAttending } = await getGuestOverview(weddingId);
    return authJson({ data: {
      totalGuests: groups, pendingInvitations: pending, attendingInvitations: attending,
      notAttendingInvitations: declined, totalPeopleAttending: peopleAttending,
    } });
  });
}
