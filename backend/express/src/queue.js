const { randomUUID } = require('crypto');

const { pool, query } = require('./db');
const { optimizeAssignments, buildOptimizationResult, persistOptimizationResult } = require('./optimization');

let workerTimer = null;
let workerBusy = false;

async function enqueueOptimizationJob(payload) {
  const jobId = randomUUID();

  await query(
    `
      INSERT INTO optimization_jobs (id, account_id, status, payload)
      VALUES ($1, $2, 'queued', $3::jsonb)
    `,
    [jobId, payload.accountId, JSON.stringify(payload)],
  );

  return jobId;
}

async function claimNextJob() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const claim = await client.query(
      `
        WITH next_job AS (
          SELECT id, account_id, payload
          FROM optimization_jobs
          WHERE status = 'queued'
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE optimization_jobs
        SET status = 'in_progress', started_at = NOW()
        FROM next_job
        WHERE optimization_jobs.id = next_job.id
        RETURNING optimization_jobs.id, next_job.account_id, next_job.payload
      `,
    );

    await client.query('COMMIT');

    if (claim.rowCount === 0) {
      return null;
    }

    return {
      id: claim.rows[0].id,
      accountId: claim.rows[0].account_id,
      payload: claim.rows[0].payload,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markJobFailed(jobId, errorMessage) {
  await query(
    `
      UPDATE optimization_jobs
      SET status = 'failed', finished_at = NOW(), error = $2
      WHERE id = $1
    `,
    [jobId, errorMessage],
  );
}

async function markJobCompleted(jobId, resultId) {
  await query(
    `
      UPDATE optimization_jobs
      SET status = 'completed', finished_at = NOW(), result_id = $2
      WHERE id = $1
    `,
    [jobId, resultId],
  );
}

async function processNextJob() {
  let job = null;
  if (workerBusy) {
    return;
  }

  workerBusy = true;
  try {
    job = await claimNextJob();
    if (!job) {
      return;
    }

    const payload = job.payload || {};
    const drivers = payload.drivers || [];
    const passengers = payload.passengers || [];

    const assignment = optimizeAssignments(drivers, passengers);
    const resultId = randomUUID();
    const result = buildOptimizationResult(resultId, assignment, job.accountId || null);

    await persistOptimizationResult(result);
    await markJobCompleted(job.id, resultId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (job) {
      await markJobFailed(job.id, message);
    }
  } finally {
    workerBusy = false;
  }
}

function startOptimizationWorker(options = {}) {
  const intervalMs = Number(options.intervalMs || 1000);

  if (workerTimer) {
    return;
  }

  workerTimer = setInterval(() => {
    processNextJob().catch((err) => {
      console.error('Optimization worker failed', err);
    });
  }, intervalMs);
}

async function getOptimizationJob(jobId) {
  const result = await query(
    `
      SELECT id, account_id, status, result_id, error, created_at, started_at, finished_at
      FROM optimization_jobs
      WHERE id = $1
    `,
    [jobId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    accountId: row.account_id,
    status: row.status,
    resultId: row.result_id,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

async function getOptimizationJobForAccount(jobId, accountId) {
  const result = await query(
    `
      SELECT id, account_id, status, result_id, error, created_at, started_at, finished_at
      FROM optimization_jobs
      WHERE id = $1 AND account_id = $2
    `,
    [jobId, accountId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    accountId: row.account_id,
    status: row.status,
    resultId: row.result_id,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

module.exports = {
  enqueueOptimizationJob,
  startOptimizationWorker,
  getOptimizationJob,
  getOptimizationJobForAccount,
};
