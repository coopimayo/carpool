const express = require('express');
const cors = require('cors');

const usersRouter = require('./routes/users');
const carpoolRouter = require('./routes/carpool');
const routesRouter = require('./routes/routes');
const authRouter = require('./routes/auth');
const { startOptimizationWorker } = require('./queue');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res.send('Express server is running');
});

app.use('/users', usersRouter);
app.use('/carpool', carpoolRouter);
app.use('/routes', routesRouter);
app.use('/auth', authRouter);

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  return next();
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

startOptimizationWorker();
