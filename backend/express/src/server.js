const express = require('express');

const usersRouter = require('./routes/users');
const carpoolRouter = require('./routes/carpool');
const routesRouter = require('./routes/routes');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res.send('Express server is running');
});

app.use('/users', usersRouter);
app.use('/carpool', carpoolRouter);
app.use('/routes', routesRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
