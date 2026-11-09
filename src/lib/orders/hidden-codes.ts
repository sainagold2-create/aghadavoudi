/** کدهای نمونهٔ seed که در پنل ادمین نشان داده نمی‌شوند */
export function isHiddenAdminOrderCode(code: string) {
  return code.startsWith("SG-MTO-SEED-");
}
