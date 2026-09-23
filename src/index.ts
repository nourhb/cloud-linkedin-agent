#!/usr/bin/env node
import { loadConfig } from './config/config.js';
import { runDailyWorkflow } from './workflow.js';
import { logger } from './utils/logger.js';

function printBanner(): void {
  console.log('\nCloudLinkedIn Agent\n');
}

function printResult(result: Awaited<ReturnType<typeof runDailyWorkflow>>): void {
  const { run, generatedPost } = result;

  if (generatedPost) {
    console.log(`Topic:\n${generatedPost.topic}\n`);
    console.log(`Category:\n${generatedPost.category}\n`);
  }

  console.log(`Status:\n${run.status === 'success' ? 'Generated' : run.status}\n`);

  if (run.status === 'dry_run' && generatedPost) {
    console.log('GENERATED POST\n');
    console.log('-------------------------\n');
    console.log(`${generatedPost.hook}\n\n${generatedPost.body}\n`);
    console.log(`Hashtags: ${generatedPost.hashtags.join(' ')}\n`);
    console.log('-------------------------\n');
    console.log('NOT PUBLISHED\n');
    console.log('Reason:\nDRY_RUN=true\n');
    return;
  }

  console.log(`Validation:\n${generatedPost ? 'PASS' : 'FAIL'}\n`);
  console.log(`Duplicate check:\n${generatedPost ? 'PASS' : 'FAIL'}\n`);
  console.log(`Publish:\n${run.status === 'success' ? 'YES' : 'NO'}\n`);
  console.log(`LinkedIn:\n${run.status === 'success' ? 'SUCCESS' : run.status === 'failed' ? 'FAILED' : 'N/A'}\n`);
  if (run.linkedinPostId) {
    console.log(`Post ID:\n${run.linkedinPostId}\n`);
  }
  if (run.error) {
    console.log(`Error (${run.errorCategory ?? 'UNKNOWN_ERROR'}):\n${run.error}\n`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'generate';

  if (command !== 'generate') {
    console.error(`Unknown command "${command}". Supported commands: generate`);
    process.exitCode = 1;
    return;
  }

  const forceDryRun = args.includes('--dry');
  const forcePublish = args.includes('--publish');

  if (forceDryRun && forcePublish) {
    console.error('Cannot use both --dry and --publish at the same time.');
    process.exitCode = 1;
    return;
  }

  printBanner();

  const config = loadConfig();
  const result = await runDailyWorkflow(config, { forceDryRun, forcePublish });

  printResult(result);

  if (result.run.status === 'failed') {
    process.exitCode = 1;
  }
}

// Graceful shutdown (SPEC section 71).
let shuttingDown = false;
function handleShutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn(`Received ${signal}, shutting down gracefully.`);
  process.exit(130);
}
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

main().catch((error: unknown) => {
  logger.error('Unhandled error', { error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
});
