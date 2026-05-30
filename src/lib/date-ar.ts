import { format, formatDistanceToNow, isAfter } from "date-fns";
import { ar } from "date-fns/locale";

const AR_DIGITS = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
export function toArabicDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

export function formatArDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return toArabicDigits(format(date, "EEEE، d MMMM yyyy", { locale: ar }));
}

export function formatArDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return toArabicDigits(format(date, "d MMMM yyyy · h:mm a", { locale: ar }));
}

export function formatArTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return toArabicDigits(format(date, "h:mm a", { locale: ar }));
}

export function formatArRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return toArabicDigits(formatDistanceToNow(date, { addSuffix: true, locale: ar }));
}

export function isLate(deadline: Date | string): boolean {
  return isAfter(new Date(), typeof deadline === "string" ? new Date(deadline) : deadline);
}
