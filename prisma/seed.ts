import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  await prisma.smsMessage.deleteMany();
  await prisma.labCartItem.deleteMany();
  await prisma.makerFollowUpTask.deleteMany();
  await prisma.orderNote.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderFile.deleteMany();
  await prisma.orderSizeLine.deleteMany();
  await prisma.customOrder.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.labProduct.deleteMany();
  await prisma.customerAccount.deleteMany();
  await prisma.staffUser.deleteMany();

  const passwordHash = await bcrypt.hash("SainaGold@1404", 10);

  const admin = await prisma.staffUser.create({
    data: {
      email: "admin@sainagold.ir",
      name: "مدیر سامانه",
      role: "admin",
      passwordHash,
    },
  });
  const orders = await prisma.staffUser.create({
    data: {
      email: "orders@sainagold.ir",
      name: "کارشناس سفارشات",
      role: "orders",
      passwordHash,
    },
  });
  const supply = await prisma.staffUser.create({
    data: {
      email: "supply@sainagold.ir",
      name: "کارشناس تأمین",
      role: "supply",
      passwordHash,
    },
  });

  const products = await Promise.all([
    prisma.labProduct.create({
      data: { sku: "LAB-RING-001", title: "انگشتر سفارشی آزمایشی", activeStock: true },
    }),
    prisma.labProduct.create({
      data: { sku: "LAB-NECK-001", title: "گردنبند سفارشی آزمایشی", activeStock: true },
    }),
    prisma.labProduct.create({
      data: { sku: "LAB-FAIL-CART", title: "کالای خطای سبد", activeStock: true },
    }),
    prisma.labProduct.create({
      data: { sku: "LAB-INACTIVE", title: "کالای بدون موجودی فعال", activeStock: false },
    }),
  ]);

  const c1 = await prisma.customerAccount.create({
    data: { phone: "09121111111", name: "سارا نمونه" },
  });
  const c2 = await prisma.customerAccount.create({
    data: { phone: "09122222222", name: "رضا نمونه" },
  });

  const storage = path.join(process.cwd(), "storage", "private");
  await mkdir(storage, { recursive: true });
  const sampleFile = "seed-design-1.txt";
  await writeFile(path.join(storage, sampleFile), "نمونه طرح ساختنی");

  const addDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };

  const pending = await prisma.customOrder.create({
    data: {
      code: "SG-MTO-SEED-PENDING",
      status: "pending_review",
      customerName: c1.name!,
      customerPhone: c1.phone,
      customerId: c1.id,
      productGroup: "alango",
      productName: "النگو طرح گل",
      description: "طلا ۱۸ عیار، رنگ زرد",
      shippingAddress: "تهران، خیابان نمونه",
      salesOwnerId: orders.id,
      ordersDecisionDueAt: addDays(-1),
      files: {
        create: {
          originalName: "طرح.pdf",
          storedName: sampleFile,
          mimeType: "text/plain",
          sizeBytes: 32,
        },
      },
      sizeLines: {
        create: [
          { size: "2", quantity: 3 },
          { size: "2.5", quantity: 2 },
        ],
      },
      history: {
        create: {
          toStatus: "pending_review",
          note: "ثبت نمونه النگو — تعیین‌تکلیف حداکثر تا پایان فردا",
          actorType: "system",
        },
      },
    },
  });

  const supplyQueue = await prisma.customOrder.create({
    data: {
      code: "SG-MTO-SEED-SUPPLY",
      status: "awaiting_supply",
      customerName: c2.name!,
      customerPhone: c2.phone,
      customerId: c2.id,
      productGroup: "ring",
      productName: "انگشتر مردانه",
      description: "طلا سفید، حکاکی داخل حلقه",
      shippingAddress: "اصفهان",
      customerReadyDueAt: addDays(4),
      ordersDecisionDueAt: addDays(-1),
      ordersReviewedAt: addDays(-1),
      salesOwnerId: orders.id,
      history: {
        create: [
          { toStatus: "pending_review", actorType: "system", note: "ثبت" },
          {
            fromStatus: "pending_review",
            toStatus: "awaiting_supply",
            actorType: "staff",
            staffId: orders.id,
            note: "بررسی سفارش: نیازمند سفارش",
          },
        ],
      },
    },
  });

  const needsCheck = await prisma.customOrder.create({
    data: {
      code: "SG-MTO-SEED-DUE",
      status: "awaiting_supplier",
      customerName: c1.name!,
      customerPhone: c1.phone,
      customerId: c1.id,
      productGroup: "necklace",
      productName: "گردنبند سفارشی",
      description: "طول ۴۵ سانتی‌متر",
      shippingAddress: "تهران",
      supplierName: "طلای پارس",
      supplierDueAt: addDays(-1),
      supplierDueAtInitial: addDays(-1),
      supplierDelayCount: 0,
      customerReadyDueAt: addDays(5),
      ordersDecisionDueAt: addDays(-4),
      ordersReviewedAt: addDays(-3),
      supplyReviewedAt: addDays(-2),
      salesOwnerId: orders.id,
      supplyOwnerId: supply.id,
      productionSmsSentAt: new Date(),
      history: {
        create: [
          { toStatus: "pending_review", actorType: "system" },
          {
            fromStatus: "pending_review",
            toStatus: "awaiting_supply",
            actorType: "staff",
            staffId: orders.id,
            note: "نیازمند سفارش",
          },
          {
            fromStatus: "awaiting_supply",
            toStatus: "awaiting_supplier",
            actorType: "staff",
            staffId: supply.id,
            note: "سفارش به تأمین‌کننده ثبت شد — تاریخ تحویل گذشته",
          },
        ],
      },
    },
  });

  const c3 = await prisma.customerAccount.create({
    data: { phone: "09123333333", name: "مینا کریمی" },
  });
  const c4 = await prisma.customerAccount.create({
    data: { phone: "09124444444", name: "علی محمدی" },
  });

  const more = await Promise.all([
    prisma.customOrder.create({
      data: {
        code: "SG-MTO-DEMO-01",
        status: "pending_review",
        customerName: c3.name!,
        customerPhone: c3.phone,
        customerId: c3.id,
        productGroup: "earring",
        productName: "گوشواره میخی",
        description: "طلا زرد، نگین کوچک",
        shippingAddress: "کرج",
        salesOwnerId: orders.id,
        ordersDecisionDueAt: addDays(1),
        history: { create: { toStatus: "pending_review", actorType: "system", note: "ثبت" } },
      },
    }),
    prisma.customOrder.create({
      data: {
        code: "SG-MTO-DEMO-02",
        status: "awaiting_supplier",
        customerName: c4.name!,
        customerPhone: c4.phone,
        customerId: c4.id,
        productGroup: "bracelet",
        productName: "دستبند زنجیری",
        description: "طول ۱۸ سانتی‌متر",
        shippingAddress: "شیراز",
        supplierName: "زرگر جنوب",
        supplierDueAt: addDays(3),
        ordersReviewedAt: addDays(-2),
        supplyReviewedAt: addDays(-1),
        salesOwnerId: orders.id,
        supplyOwnerId: supply.id,
        history: {
          create: [
            { toStatus: "pending_review", actorType: "system" },
            {
              fromStatus: "pending_review",
              toStatus: "awaiting_supply",
              actorType: "staff",
              staffId: orders.id,
              note: "نیازمند سفارش",
            },
            {
              fromStatus: "awaiting_supply",
              toStatus: "awaiting_supplier",
              actorType: "staff",
              staffId: supply.id,
              note: "سفارش به تأمین‌کننده ثبت شد",
            },
          ],
        },
      },
    }),
    prisma.customOrder.create({
      data: {
        code: "SG-MTO-DEMO-03",
        status: "completed",
        customerName: c2.name!,
        customerPhone: c2.phone,
        customerId: c2.id,
        productGroup: "ring",
        productName: "انگشتر ساده",
        description: "موجودی انبار",
        shippingAddress: "تهران",
        salesOwnerId: orders.id,
        ordersReviewedAt: addDays(-5),
        readyAt: addDays(-1),
        completedAt: addDays(-1),
        history: {
          create: [
            { toStatus: "pending_review", actorType: "system" },
            {
              fromStatus: "pending_review",
              toStatus: "completed",
              actorType: "staff",
              staffId: orders.id,
              note: "موجود است و تکمیل شد",
            },
          ],
        },
      },
    }),
    prisma.customOrder.create({
      data: {
        code: "SG-MTO-DEMO-04",
        status: "awaiting_supply",
        customerName: c3.name!,
        customerPhone: c3.phone,
        customerId: c3.id,
        productGroup: "alango",
        productName: "النگو پهن",
        description: "طلا سفید",
        shippingAddress: "مشهد",
        salesOwnerId: orders.id,
        ordersReviewedAt: addDays(-1),
        sizeLines: {
          create: [
            { size: "1", quantity: 2 },
            { size: "3", quantity: 1 },
          ],
        },
        history: {
          create: [
            { toStatus: "pending_review", actorType: "system" },
            {
              fromStatus: "pending_review",
              toStatus: "awaiting_supply",
              actorType: "staff",
              staffId: orders.id,
              note: "نیازمند سفارش",
            },
          ],
        },
      },
    }),
    prisma.customOrder.create({
      data: {
        code: "SG-MTO-DEMO-05",
        status: "awaiting_supplier",
        customerName: c4.name!,
        customerPhone: c4.phone,
        customerId: c4.id,
        productGroup: "pendant",
        productName: "پلاک اسم",
        description: "حکاکی فارسی",
        shippingAddress: "اهواز",
        supplierName: "طلای پارس",
        supplierDueAt: addDays(-3),
        supplierDueAtInitial: addDays(-10),
        supplierDelayCount: 1,
        supplierDelayDaysAccrued: 7,
        ordersReviewedAt: addDays(-6),
        supplyReviewedAt: addDays(-5),
        salesOwnerId: orders.id,
        supplyOwnerId: supply.id,
        history: {
          create: [
            { toStatus: "pending_review", actorType: "system" },
            {
              fromStatus: "awaiting_supply",
              toStatus: "awaiting_supplier",
              actorType: "staff",
              staffId: supply.id,
              note: "سفارش به تأمین‌کننده",
            },
            {
              fromStatus: "awaiting_supplier",
              toStatus: "awaiting_supplier",
              actorType: "staff",
              staffId: supply.id,
              note: "تأخیر تأمین‌کننده ثبت شد",
            },
          ],
        },
      },
    }),
  ]);

  console.log("Seed OK", {
    admin: admin.email,
    orders: orders.email,
    supply: supply.email,
    password: "SainaGold@1404",
    products: products.map((p) => p.sku),
    sampleOrders: [
      pending.code,
      supplyQueue.code,
      needsCheck.code,
      ...more.map((o) => o.code),
    ],
    otp: process.env.DEV_OTP_CODE || "12345",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
