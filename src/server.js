import { createApp } from './app.js';
import { readConfig } from './security.js';
const config = readConfig();
const app = createApp(config);
const server = app.listen(config.port, config.host, () => console.log(`설비마루 ${config.mode}: ${config.origin}`));
server.requestTimeout = 20000; server.headersTimeout = 10000;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { app.locals.store.close(); process.exit(0); }));
