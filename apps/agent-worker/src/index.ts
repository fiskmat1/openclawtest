import { startAgentWorker } from './worker';

const worker = await startAgentWorker();

const shutdown = async (): Promise<void> => {
  await worker.stop();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

console.info('[agent-worker] running');
