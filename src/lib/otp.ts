import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const DEV_OTP = () => process.env.DEV_OTP_CODE || "12345";

export async function issueOtp(params: {
  phone: string;
  purpose: "submit" | "track" | "login";
  orderCode?: string;
}) {
  const code = DEV_OTP();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.otpChallenge.create({
    data: {
      phone: params.phone,
      purpose: params.purpose,
      orderCode: params.orderCode,
      codeHash,
      expiresAt,
    },
  });
  console.log(`[OTP:lab] phone=${params.phone} purpose=${params.purpose} code=${code}`);
  return { expiresAt, previewCode: process.env.NODE_ENV === "production" ? undefined : code };
}

export async function verifyOtp(params: {
  phone: string;
  purpose: "submit" | "track" | "login";
  code: string;
  orderCode?: string;
}): Promise<boolean> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      phone: params.phone,
      purpose: params.purpose,
      consumed: false,
      expiresAt: { gt: new Date() },
      ...(params.orderCode ? { orderCode: params.orderCode } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return false;
  const ok = await bcrypt.compare(params.code, challenge.codeHash);
  if (!ok) return false;
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumed: true },
  });
  return true;
}
