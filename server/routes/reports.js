import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { mapReport } from './state.js';

export const router = Router();

const canEdit = [requireAuth, requireRole('admin', 'team')];

// Normalise a results array of { text, link }.
function cleanResults(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((r) => ({
    text: String(r.text || '').trim(),
    link: String(r.link || '').trim(),
  })).filter((r) => r.text || r.link);
}

async function fetchReport(id) {
  const { rows } = await pool.query(
    `SELECT id, project_id, month, title, results, show_client FROM reports WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapReport(rows[0]) : null;
}

router.post('/reports', canEdit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const projectId = b.projectId ? parseInt(b.projectId, 10) : null;
    const { rows } = await pool.query(
      `INSERT INTO reports (project_id, month, title, results, show_client)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [projectId, b.month || '', String(b.title || '').trim(), JSON.stringify(cleanResults(b.results)), b.showClient !== false]
    );
    res.status(201).json(await fetchReport(rows[0].id));
  } catch (err) {
    next(err);
  }
});

router.patch('/reports/:id', canEdit, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const fields = [];
    const vals = [];
    let i = 1;
    const set = (col, val) => { fields.push(`${col} = $${i++}`); vals.push(val); };
    if (b.projectId !== undefined) set('project_id', b.projectId ? parseInt(b.projectId, 10) : null);
    if (b.month !== undefined) set('month', b.month);
    if (b.title !== undefined) set('title', String(b.title).trim());
    if (b.results !== undefined) set('results', JSON.stringify(cleanResults(b.results)));
    if (b.showClient !== undefined) set('show_client', !!b.showClient);
    if (!fields.length) return res.json(await fetchReport(id));
    vals.push(id);
    await pool.query(`UPDATE reports SET ${fields.join(', ')} WHERE id = $${i}`, vals);
    const updated = await fetchReport(id);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/reports/:id', canEdit, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM reports WHERE id = $1`, [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
