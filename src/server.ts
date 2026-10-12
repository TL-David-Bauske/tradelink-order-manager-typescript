import { createApp } from './app.js';
import { openDatabase } from './database.js';

const db = await openDatabase();
const port = Number(process.env.PORT ?? 3000);
const server = createApp(db).listen(port, () => {
  console.log(`Order manager listening on http://localhost:${port}`);
});

function shutdown(): void {
  server.close(() => {
    db.close().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
