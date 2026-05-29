import './env.js';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { initSchema } from './db.js';
import { seedIfEmpty } from './seed.js';
import { loginHandler } from './auth.js';
import { router as stateRouter } from './routes/state.js';
import { router as projectsRouter } from './routes/projects.js';
import { router as tasksRouter } from './routes/tasks.js';
import { router as goalsRouter } from './routes/goals.js';
import { router as settingsRouter } from './routes/settings.js';
import { router as slackRouter } from './slack/tick.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check (also handy for keeping the host awake)
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.post('/api/login', loginHandler);
app.use('/api', stateRouter);
app.use('/api', projectsRouter);
app.use('/api', tasksRouter);
app.use('/api', goalsRouter);
app.use('/api', settingsRouter);
app.use('/api', slackRouter);

// Serve the frontend
app.use(express.static(join(__dirname, '..', 'public')));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 3000;

initSchema()
  .then(() => seedIfEmpty())
  .then(() => {
    app.listen(PORT, () => console.log(`Portal running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to init DB:', err);
    process.exit(1);
  });
