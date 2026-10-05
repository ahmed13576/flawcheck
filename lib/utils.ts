/**
 * cn — the single class-merge helper (03-00 Task 2): clsx for conditional
 * classes, tailwind-merge for conflict resolution. Every restyled Flowstep
 * component composes classes through this.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
