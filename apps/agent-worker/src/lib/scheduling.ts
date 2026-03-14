import { CronExpressionParser } from 'cron-parser';

export function getNextRunAt(
  cron: string | null | undefined,
  currentDate: Date = new Date()
): Date | null {
  if (!cron) {
    return null;
  }

  try {
    return CronExpressionParser.parse(cron, {
      currentDate
    })
      .next()
      .toDate();
  } catch {
    return null;
  }
}
