/**
 * Backend public entrypoint + optional direct-run for local dev.
 * Single source of truth: service composition lives in createBackendServices (lib.ts).
 */
export * from '../../types';
import { createBackendServices } from './lib.js';

// Direct run (node dist-vite/index.mjs) -> bootstrap via factory only once
if (import.meta.url === `file://${process.argv[1]}`) {
  createBackendServices()
    .then(svcs => {
      // eslint-disable-next-line no-console
      console.log('Backend services started', { wsPort: svcs.config.wsPort });
      const shutdown = async (signal: string) => {
        // eslint-disable-next-line no-console
        console.log(`Shutdown signal ${signal}`);
        await svcs.shutdown();
        process.exit(0);
      };
      process.on('SIGINT', () => void shutdown('SIGINT'));
      process.on('SIGTERM', () => void shutdown('SIGTERM'));
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error('Fatal startup error', err);
      process.exit(1);
    });
}
