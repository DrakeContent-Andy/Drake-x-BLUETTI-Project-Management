import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

export const router = Router();

// Replace the full assignees list (admin or team).
router.patch('/settings/assignees', requireAuth, requireRole('admin', 'team'), async (req, res, next) => {
  try {
    const list = Array.isArray(req.body?.assignees)
      ? req.body.assignees.map((a) => String(a).trim()).filter(Boolean)
      : [];
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('assignees', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(list)]
    );
    res.json({ assignees: list });
  } catch (err) {
    next(err);
  }
});

// Slack config (admin only). Token lives in env, not here — never returned to the client.
router.get('/settings/slack', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = 'slack'`);
    res.json({ slack: rows[0] ? rows[0].value : null, tokenConfigured: !!process.env.SLACK_BOT_TOKEN });
  } catch (err) {
    next(err);
  }
});

router.patch('/settings/slack', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = 'slack'`);
    const current = rows[0] ? rows[0].value : {};
    const allowed = ['enabled', 'weeklyChannel', 'overdueChannel', 'monthlyChannel',
      'weeklyDay', 'weeklyTime', 'monthlyDay', 'monthlyTime', 'timezone'];
    const merged = { ...current };
    for (const k of allowed) {
      if (req.body && req.body[k] !== undefined) merged[k] = req.body[k];
    }
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('slack', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(merged)]
    );
    res.json({ slack: merged });
  } catch (err) {
    next(err);
  }
});
