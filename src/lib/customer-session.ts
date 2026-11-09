import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE = "mto_customer_id";

export async function setCustomerSession(customerId: string) {
  const jar = await cookies();
  jar.set(COOKIE, customerId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearCustomerSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getCustomerSession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  return prisma.customerAccount.findUnique({ where: { id } });
}
