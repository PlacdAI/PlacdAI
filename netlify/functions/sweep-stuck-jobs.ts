// Netlify Scheduled Function — runs on a cron schedule (see netlify.toml
// entry below), independent of any single request/response cycle. This is
// the backstop for credits getting silently stranded: fix #1 in
// start-generation.ts / swap-product-start.ts catches the case where the
// hand-off to the background function visibly fails, but it can't catch
// every way a background function can die AFTER being invoked
// successfully — a hard platform kill, an out-of-memory crash, or any
// failure that happens before its own try/catch even starts. In all of
// those cases the row is left at 'pending' forever with no code path left
// to ever mark it 'failed' or trigger a refund.
//
// This sweep doesn't care why a job got stuck — it just finds any row
// still 'pending' well past how long these jobs ever legitimately take
// (generate-room-background: ~20-40s typical, swap-product-background: up
// to ~90s for 3 sequential edits) and closes it out, refunding the credit
// if one was charged. STUCK_AFTER_MINUTES is set well above worst-case
// legitimate runtime so this never races a job that's still genuinely in
// progress.
import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const STUCK_AFTER_MINUTES = 10;

export default async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString();

  // Room generations — always refund, since the credit is always consumed
  // up-front for these (dashboard.tsx's generate()).
  const staleGenerations = await supabase
    .from("generations")
    .select("id, user_id")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  for (const row of staleGenerations.data ?? []) {
    console.warn(`Sweeping stuck generation ${row.id} (user ${row.user_id})`);
    await supabase
      .from("generations")
      .update({
        status: "failed",
        error: `Timed out after ${STUCK_AFTER_MINUTES} minutes with no result — auto-refunded.`,
      })
      .eq("id", row.id);

    const refund = await supabase.rpc("refund_credit", { _user_id: row.user_id });
    if (refund.error) {
      console.error(`Sweep: failed to refund credit for user ${row.user_id}:`, refund.error.message);
    }
  }

  // Product swaps — only refund the ones that were actually a paid retry;
  // the main-flow swap rides on the generation's own up-front credit and
  // was never charged separately (same distinction swap-product-start.ts
  // and swap-product-background.ts already make on their own failure
  // paths).
  const staleSwaps = await supabase
    .from("product_swaps")
    .select("id, user_id, is_retry")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  for (const row of staleSwaps.data ?? []) {
    console.warn(`Sweeping stuck product swap ${row.id} (user ${row.user_id})`);
    await supabase
      .from("product_swaps")
      .update({
        status: "failed",
        error: `Timed out after ${STUCK_AFTER_MINUTES} minutes with no result — auto-refunded.`,
      })
      .eq("id", row.id);

    if (row.is_retry) {
      const refund = await supabase.rpc("refund_credit", { _user_id: row.user_id });
      if (refund.error) {
        console.error(`Sweep: failed to refund credit for user ${row.user_id}:`, refund.error.message);
      }
    }
  }
};

// Every 5 minutes.
export const config: Config = {
  schedule: "*/5 * * * *",
};