import type { MaintenanceTaskRecord, WarrantyRecord } from '@/src/types/homevault';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatINR(amount: number, currency = 'INR'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    return `₹${Math.round(safe).toLocaleString('en-IN')}`;
  }
}

/**
 * Formats YYYY-MM-DD or ISO timestamp into DD MMM YYYY (e.g. 14 Mar 2024)
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parsed = parseIsoDate(dateStr);
  if (!parsed) return dateStr;
  const day = String(parsed.getDate()).padStart(2, '0');
  const mon = MONTHS[parsed.getMonth()];
  const year = parsed.getFullYear();
  return `${day} ${mon} ${year}`;
}

export function parseIsoDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const datePart = dateStr.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = parseIsoDate(isoDate) ?? new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysUntil(targetIso: string): number {
  const target = parseIsoDate(targetIso);
  if (!target) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / 86_400_000);
}

export type WarrantyHealth = 'active' | 'expiring_soon' | 'expired' | 'none';

export function evaluateWarranty(
  warranty?: WarrantyRecord | null,
  alertThresholdDays = 30
): { health: WarrantyHealth; daysLeft: number; label: string } {
  if (!warranty) {
    return { health: 'none', daysLeft: 0, label: 'No Warranty Recorded' };
  }
  const daysLeft = daysUntil(warranty.expiryDate);
  if (daysLeft < 0) {
    return { health: 'expired', daysLeft, label: 'Warranty Expired' };
  }
  if (daysLeft <= alertThresholdDays) {
    return {
      health: 'expiring_soon',
      daysLeft,
      label: daysLeft === 0 ? 'Expires Today' : `Expires in ${daysLeft} days`,
    };
  }
  if (warranty.warrantyType === 'AppleCare+') {
    return { health: 'active', daysLeft, label: 'AppleCare+ Active' };
  }
  if (warranty.warrantyType === 'Extended Care') {
    const years = Math.round(daysLeft / 365);
    return {
      health: 'active',
      daysLeft,
      label: years >= 2 ? `Extended Care Active · ${years} years` : `Extended Care · ${daysLeft} days`,
    };
  }
  return {
    health: 'active',
    daysLeft,
    label: `Warranty Active · ${daysLeft} days`,
  };
}

export type MaintenanceHealth = 'overdue' | 'due_today' | 'upcoming' | 'completed';

export function evaluateMaintenanceTask(task: MaintenanceTaskRecord): {
  health: MaintenanceHealth;
  daysDelta: number;
  label: string;
} {
  if (task.isCompleted) {
    return { health: 'completed', daysDelta: 0, label: 'Completed' };
  }
  const delta = daysUntil(task.nextServiceDate);
  if (delta < 0) {
    return { health: 'overdue', daysDelta: delta, label: `Overdue by ${Math.abs(delta)}d` };
  }
  if (delta === 0) {
    return { health: 'due_today', daysDelta: 0, label: 'Due Today' };
  }
  return { health: 'upcoming', daysDelta: delta, label: `Due in ${delta} days` };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val < 10 && idx > 0 ? val.toFixed(1) : Math.round(val)} ${units[idx]}`;
}
