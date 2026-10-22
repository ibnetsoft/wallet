import type { PoolClient } from "pg";
import { advanceSweep } from "./trc20-sweep";

// Session-level lock also covers executions on other Vercel instances. Each
// request additionally has a persisted lease and pre-broadcast signed outbox.
export async function runAutomaticSweeps(client:PoolClient, step=advanceSweep) {
  const enabled=(await client.query("SELECT value FROM public.system_settings WHERE key='tron_sweep_enabled'")).rows[0]?.value === 'true';
  if (!enabled) return {enabled:false,busy:false,checked:0,requests:[]};
  const locked=(await client.query('SELECT pg_try_advisory_lock(969, 20261022) AS locked')).rows[0]?.locked;
  if (!locked) return {enabled:true,busy:true,checked:0,requests:[]};
  try {
    // One company transaction at a time; never create or approve a new sweep.
    const row=(await client.query<{id:string}>(`SELECT id FROM public.trc20_sweep_requests
      WHERE status IN ('PENDING','GAS_FUNDED','SWEEPING')
        AND (lease_until IS NULL OR lease_until<now())
      ORDER BY created_at,id LIMIT 1`)).rows[0];
    if (!row) return {enabled:true,busy:false,checked:0,requests:[]};
    await client.query(`UPDATE public.trc20_sweep_requests
      SET auto_attempt_count=auto_attempt_count+1,last_auto_attempt_at=now() WHERE id=$1`,[row.id]);
    const result=await step(client,row.id);
    return {enabled:true,busy:Boolean(result.busy),checked:1,requests:[result.request]};
  } finally { await client.query('SELECT pg_advisory_unlock(969, 20261022)'); }
}
