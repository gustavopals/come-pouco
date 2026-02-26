const { Router } = require('express');
const authRouter = require('./auth.routes');

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/auth', authRouter);

module.exports = router;
