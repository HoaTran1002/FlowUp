import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** The shadcn/ui class composer: merges conditional and conflicting classes. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
