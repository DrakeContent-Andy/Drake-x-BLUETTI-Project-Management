import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { loadState } from '../routes/state.js';
import { postMessage, listChannels, slackConfigured } from './client.js';
import {
  buildWeekly, buildOverdue, buildMonthly,
  todayInTz, dowInTz, hhmmInTz, monthLabelInTz, dayOfMonthInTz, isLastDayOfMonth,
} from './messages.js';

export const router = Router();

async function getSlackConfig() {
  const { rows } = await pool.query(`SELECT value FROM settings WHERE key = 'slack'`);
  return rows[0] ? rows[0].value : null;
}

// Claim a (kind, period) slot. Returns true if we are the first to claim it.
async function claim(kind, period) {
  const { rows } = await pool.query(
    `INSERT INTO slack_log (kind, period) VALUES ($1,$2)
     ON CONFLICT (kind, period) DO NOTHING RETURNING id`,
    [kind, period]
  );
  return rows.length > 0;
}

async function runWeekly(cfg, state) {
  const m = buildWeekly(state, cfg.timezone);
  if (cfg.weeklyChannel) await postMessage(cfg.weeklyChannel, m.text, m.blocks);
}
async function runOverdue(cfg, state) {
  const m = buildOverdue(state, cfg.timezone);
  if (cfg.overdueChannel) await postMessage(cfg.overdueChannel, m.text, m.blocks);
}
async function runMonthly(cfg, state, monthLabel) {
  const m = buildMonthly(state, monthLabel);
  if (cfg.monthlyChannel) await postMessage(cfg.monthlyChannel, m.text, m.blocks);
}

// ── Cron endpoint: called by cron-job.org every ~15 min ──
// Secret may be passed as ?secret= or X-Cron-Secret header.
router.post('/cron/tick', async (req, res, next) => {
  try {
    const secret = req.query.secret || req.headers['x-cron-secret'];
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const cfg = await getSlackConfig();
    const result = { ran: [] };

    if (!cfg || !cfg.enabled) return res.json({ skipped: 'slack disabled', ...result });
    if (!slackConfigured()) return res.json({ skipped: 'no bot token', ...result });

    const tz = cfg.timezone || 'Australia/Sydney';
    const today = todayInTz(tz);
    const dow = dowInTz(tz);
    const now = hhmmInTz(tz);
    const state = await loadState('admin');

    // Weekly + overdue fire on the configured weekday, at/after the configured time.
    if (dow === Number(cfg.weeklyDay) && now >= (cfg.weeklyTime || '09:00')) {
      if (await claim('weekly', today)) { await runWeekly(cfg, state); result.ran.push('weekly'); }
      if (await claim('overdue', today)) { await runOverdue(cfg, state); result.ran.push('overdue'); }
    }

    // Monthly fires on the configured day-of-month (or last day), at/after the configured time.
    const monthLabel = monthLabelInTz(tz);
    const dom = dayOfMonthInTz(tz);
    const monthlyDue = cfg.monthlyDay === 'last' ? isLastDayOfMonth(tz) : dom === Number(cfg.monthlyDay);
    if (monthlyDue && now >= (cfg.monthlyTime || '17:00')) {
      if (await claim('monthly', monthLabel)) { await runMonthly(cfg, state, monthLabel); result.ran.push('monthly'); }
    }

    res.json({ ok: true, today, dow, now, ...result });
  } catch (err) {
    next(err);
  }
});

// ── Admin: list channels for the dropdowns ──
router.get('/slack/channels', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    if (!slackConfigured()) return res.json({ channels: [], tokenConfigured: false });
    res.json({ channels: await listChannels(), tokenConfigured: true });
  } catch (err) {
    res.status(502).json({ error: 'Slack API error: ' + (err.data?.error || err.message) });
  }
});

// ── Admin: send a test message to a chosen channel ──
router.post('/slack/test', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const channel = req.body?.channel;
    if (!channel) return res.status(400).json({ error: 'channel required' });
    await postMessage(channel, 'Test message from the Drake × BLUETTI portal :white_check_mark:');
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: 'Slack API error: ' + (err.data?.error || err.message) });
  }
});

// ── Admin: manually run a post now (ignores schedule + dedupe) ──
router.post('/slack/run', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const cfg = await getSlackConfig();
    if (!cfg) return res.status(400).json({ error: 'No slack config' });
    if (!slackConfigured()) return res.status(400).json({ error: 'No bot token configured' });
    const state = await loadState('admin');
    const kind = req.body?.kind;
    if (kind === 'weekly') await runWeekly(cfg, state);
    else if (kind === 'overdue') await runOverdue(cfg, state);
    else if (kind === 'monthly') await runMonthly(cfg, state, monthLabelInTz(cfg.timezone || 'Australia/Sydney'));
    else return res.status(400).json({ error: 'kind must be weekly | overdue | monthly' });
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: 'Slack API error: ' + (err.data?.error || err.message) });
  }
});
