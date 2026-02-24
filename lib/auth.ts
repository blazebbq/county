import { cookies } from "next/headers";

const STAFF_COOKIE = "staff_auth";
const STAFF_PIN = process.env.STAFF_PIN ?? "1234";

export function verifyStaffPin(pin: string): boolean {
  return pin === STAFF_PIN;
}

export async function isStaffAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(STAFF_COOKIE);
  return cookie?.value === "authenticated";
}

export function getStaffCookieName(): string {
  return STAFF_COOKIE;
}
