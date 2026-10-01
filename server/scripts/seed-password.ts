// Sets the admin password of whichever database DATABASE_URL points at.
// Run with `npm run seed`; both values are read from server/.env, so the
// password never has to be typed on a command line (and land in history).
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error('ADMIN_PASSWORD is not set: add it to server/.env, run again, then remove it');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.upsert({
    where: { id: 'admin' },
    update: { passwordHash: hash },
    create: { id: 'admin', passwordHash: hash },
  });

  console.log('Admin password set successfully');
}

main()
  .finally(() => prisma.$disconnect());
