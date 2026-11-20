import { logIn } from "@/modules/auth/service";
import { loginSchema } from "@/modules/auth/validation";
import { handleCredentials } from "@/server/auth/http";

export function POST(request: Request) {
  return handleCredentials(request, "login", loginSchema, logIn);
}
