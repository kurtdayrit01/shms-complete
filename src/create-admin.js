import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

dotenv.config();

const rl = readline.createInterface({ input, output });

async function createAdmin() {
  try {
    const fullName = (await rl.question('Admin full name: ')).trim();
    const email = (await rl.question('Admin email: '))
      .trim()
      .toLowerCase();
    const password = await rl.question('Admin password (minimum 8 characters): ');

    if (!fullName || !email || password.length < 8) {
      throw new Error('Enter a name, valid email, and password of at least 8 characters.');
    }

    const [existing] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      throw new Error('That email is already registered. Choose another email.');
    }

    const [roles] = await pool.execute(
      "SELECT role_id FROM roles WHERE role_name = 'Admin' LIMIT 1"
    );

    if (roles.length === 0) {
      throw new Error('Admin role was not found in the roles table.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.execute(
      `INSERT INTO users (role_id, full_name, email, password_hash)
       VALUES (?, ?, ?, ?)`,
      [roles[0].role_id, fullName, email, passwordHash]
    );

    console.log('\nAdmin account created successfully!');
    console.log(`Email: ${email}`);
    console.log('You can now sign in through your website.');
  } catch (error) {
    console.error('\nCould not create Admin:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

createAdmin();