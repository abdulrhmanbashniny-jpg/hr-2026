/** Arabic count phrase for days with correct number agreement (يوم، يومان، أيام، يوماً). */
export function arDays(n: number): string {
  const a = Math.abs(n);
  if (a === 1) return 'يوم واحد';
  if (a === 2) return 'يومان';
  if (a >= 3 && a <= 10) return `${a} أيام`;
  return `${a} يوماً`;
}

export function enDays(n: number): string {
  const a = Math.abs(n);
  return `${a} day${a === 1 ? '' : 's'}`;
}

/** "باقٍ 18 يوماً" / "منتهٍ منذ 12 يوماً" / "ينتهي اليوم" */
export function arRemaining(days: number): string {
  if (days === 0) return 'ينتهي اليوم';
  if (days < 0) return `منتهٍ منذ ${arDays(days)}`;
  return `باقٍ ${arDays(days)}`;
}

export function enRemaining(days: number): string {
  if (days === 0) return 'expires today';
  if (days < 0) return `expired ${enDays(days)} ago`;
  return `${enDays(days)} left`;
}

/** Arabic count of records with number agreement: سجل واحد، سجلان، 3 سجلات، 11 سجلاً. */
export function arRecords(n: number): string {
  if (n === 0) return 'لا سجلات';
  if (n === 1) return 'سجل واحد';
  if (n === 2) return 'سجلان';
  if (n >= 3 && n <= 10) return `${n} سجلات`;
  return `${n} سجلاً`;
}

export function enRecords(n: number): string {
  return `${n} record${n === 1 ? '' : 's'}`;
}
