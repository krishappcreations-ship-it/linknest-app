import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose Tailwind class strings while resolving conflicts.
 *
 * Used by every primitive — call it once at the top of the component body
 * to merge default + caller-supplied `className` without losing intent.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
