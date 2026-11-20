import { signUp } from "@/modules/auth/service";
import { signUpSchema } from "@/modules/auth/validation";
import { handleCredentials } from "@/server/auth/http";

export function POST(request: Request) {
  return handleCredentials(request, "signup", signUpSchema, signUp);
}
