import type { listVendors } from "@/modules/vendors/service";

export type VendorEvent = { id: string; name: string; archived: boolean };
export type VendorPage = Awaited<ReturnType<typeof listVendors>>;

export class VendorRequestError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, string>) {
    super(message);
  }

  get unconfirmedWrite() {
    return this.status === 0 || this.status >= 500 || (this.status >= 200 && this.status < 300);
  }
}

export async function vendorRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    throw new VendorRequestError(response.status, body?.error?.code ?? "",
      body?.error?.message ?? "We couldn’t load the vendor information. Try again.", body?.error?.details);
  }
  return body;
}

export function vendorTelephone(phone: string) {
  return "tel:" + (phone.startsWith("+") ? "+" : "") + phone.replace(/\D/g, "");
}

export function vendorEmail(email: string) {
  return "mailto:" + encodeURIComponent(email).replace("%40", "@");
}
