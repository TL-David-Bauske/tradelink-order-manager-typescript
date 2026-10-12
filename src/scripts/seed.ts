import { openDatabase } from '../database.js';
import { seedDatabase } from '../seed.js';

const db = await openDatabase();
try {
  await seedDatabase(db);
  console.log('Seeded three products and three warehouses.');
} finally {
  await db.close();
}
