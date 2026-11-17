import express from 'express';
import {fail} from '../src/core.js';
/** Parent app must provide req.actor, same-origin/CSRF validation and bounded JSON. */
export function actionRouter(gateway) {
  const router = express.Router();
  router.use((req, _res, next) => {
    if (req.body !== undefined && Buffer.byteLength(JSON.stringify(req.body)) > 4096) fail(413, '동작 요청은 4KiB 이하입니다.');
    next();
  });
  router.get('/catalog', (req, res) => res.json(gateway.catalog(req.actor)));
  router.post('/prepare', (req, res) => res.json(gateway.prepare(req.actor, req.body)));
  router.get('/:id', (req, res) => res.json(gateway.status(req.actor, req.params.id)));
  router.post('/:id/cancel', (req, res) => res.json(gateway.cancel(req.actor, req.params.id)));
  router.post('/:id/execute', (req, res, next) => gateway.execute(req.actor, req.params.id, req.body).then(result => res.json(result), next));
  return router;
}
