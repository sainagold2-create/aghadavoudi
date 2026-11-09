import { getServerSession } from "next-auth";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { authOptions } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-session";
import { privateFilePath } from "@/lib/orders/files";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const file = await prisma.orderFile.findUnique({
    where: { id },
    include: { order: true },
  });
  if (!file) return new Response("یافت نشد", { status: 404 });

  const staff = await getServerSession(authOptions);
  const customer = await getCustomerSession();
  const allowed =
    !!staff?.user?.id || (customer && customer.id === file.order.customerId);
  if (!allowed) return new Response("دسترسی ندارید", { status: 403 });

  const full = privateFilePath(file.storedName);
  try {
    await stat(full);
  } catch {
    return new Response("فایل موجود نیست", { status: 404 });
  }

  const nodeStream = createReadStream(full);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  const isImage = file.mimeType.startsWith("image/");
  return new Response(webStream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
