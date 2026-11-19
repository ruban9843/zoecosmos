import { prisma } from "./prisma";

/** Order code generator: FS-XXXXX, retry on collision. */
export async function uniqueOrderCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = "FS-" + Math.floor(20000 + Math.random() * 80000);
    const hit = await prisma.order.findUnique({ where: { code } });
    if (!hit) return code;
  }
  return "FS-" + Date.now().toString().slice(-6);
}
