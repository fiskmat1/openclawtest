import PgBoss from 'pg-boss';

import { keys as databaseKeys } from '@workspace/database/keys';

import { AgentJobName } from './queue';

type AgentQueue = PgBoss;

let bossPromise: Promise<AgentQueue> | undefined;

export async function getAgentQueue(): Promise<AgentQueue> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const databaseUrl = databaseKeys().DATABASE_URL;
      const boss = new PgBoss({
        connectionString: databaseUrl,
        schema: 'pgboss_agents'
      });

      await boss.start();

      return boss;
    })();
  }

  return bossPromise;
}

export async function stopAgentQueue(): Promise<void> {
  if (!bossPromise) {
    return;
  }

  const boss = await bossPromise;
  await boss.stop();
  bossPromise = undefined;
}

export async function ensureAgentQueues(): Promise<AgentQueue> {
  const boss = await getAgentQueue();

  await Promise.all(
    Object.values(AgentJobName).map(async (queueName) => {
      const existingQueue = await boss.getQueue(queueName);
      if (!existingQueue) {
        await boss.createQueue(queueName);
      }
    })
  );

  return boss;
}

export async function sendAgentJob(
  jobName: AgentJobName,
  data: object,
  options?: PgBoss.SendOptions
): Promise<string | null> {
  const boss = await ensureAgentQueues();
  return options ? boss.send(jobName, data, options) : boss.send(jobName, data);
}

export async function scheduleAgentJob(
  jobName: AgentJobName,
  cron: string,
  data: object,
  options?: PgBoss.ScheduleOptions
): Promise<void> {
  const boss = await ensureAgentQueues();
  await boss.schedule(jobName, cron, data, options);
}

export async function unscheduleAgentJob(
  jobName: AgentJobName,
  key?: string
): Promise<void> {
  const boss = await ensureAgentQueues();
  await boss.unschedule(jobName, key);
}
