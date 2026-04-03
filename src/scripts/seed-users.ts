/**
 * Seed the two allowed users into the database.
 *
 * Usage:
 *   npx tsx --env-file=.env src/scripts/seed-users.ts
 *
 * Reads TVERKON_PASSWORD and DVERKON_PASSWORD from .env file.
 * Passwords must be min 8 chars with uppercase, lowercase, digit, and special char.
 */
import { auth } from "../lib/auth";
import { pool } from "../lib/db";
import { validatePassword, PASSWORD_RULES } from "../lib/password";

console.log(process.env.TVERKON_PASSWORD, ' ', process.env.DVERKON_PASSWORD);
const tpwd = process.env.TVERKON_PASSWORD || '';
const dpwd = process.env.DVERKON_PASSWORD || '';
console.log(typeof tpwd, ' ', typeof dpwd);

const USERS = [
  {
    name: "tverkon",
    email: "tverkon@gmail.com",
    password: tpwd,
    role: "admin",
  },
  {
    name: "dverkon",
    email: "dverkon@gmail.com",
    password: dpwd,
    role: "user",
  },
];

async function seed() {
  for (const user of USERS) {
    if (!user.password) {
      console.error(`Missing password env var for ${user.email}. Set TVERKON_PASSWORD / DVERKON_PASSWORD.`);
      process.exit(1);
    }
    const pwError = validatePassword(user.password);
    if (pwError) {
      console.error(`Invalid password for ${user.email}: ${PASSWORD_RULES}`);
      process.exit(1);
    }
    try {
      const created = await auth.api.signUpEmail({
        body: {
          name: user.name,
          email: user.email,
          password: user.password,
        },
      });
      // Set the role directly in the database
      await pool.query('UPDATE "user" SET role = $1 WHERE id = $2', [user.role, created.user.id]);
      console.log(`Created user: ${user.email} (role: ${user.role})`, created.user.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // If user already exists, that's fine
      if (message.includes("already") || message.includes("duplicate") || message.includes("unique")) {
        console.log(`User ${user.email} already exists, skipping.`);
      } else {
        console.error(`Failed to create ${user.email}:`, message);
      }
    }
  }
  process.exit(0);
}

seed();
