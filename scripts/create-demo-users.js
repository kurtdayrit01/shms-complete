
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from '../src/db.js';

dotenv.config();

const users = [
  ['Staff', 'Demo Staff', 'staff@demo.local', 'Staff123!']
];

async function getRows(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function main() {
  try {
    for (const [role, name, email, password] of users) {
      const roles = await getRows(
        'SELECT role_id FROM roles WHERE role_name = ?',
        [role]
      );

      if (!roles.length) {
        throw new Error(`Role not found: ${role}`);
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const result = await pool.execute(
        `INSERT INTO users
          (role_id, full_name, email, password_hash, is_active)
         VALUES (?, ?, ?, ?, TRUE)
         ON CONFLICT (email) DO UPDATE SET
          role_id = EXCLUDED.role_id,
          full_name = EXCLUDED.full_name,
          password_hash = EXCLUDED.password_hash,
          is_active = TRUE
         RETURNING user_id`,
        [roles[0].role_id, name, email, passwordHash]
      );

      const userId = result[0]?.rows?.[0]?.user_id;

      if (!userId) {
        throw new Error(`Could not retrieve user ID for ${email}`);
      }

      console.log(`${email} ready`);
    }

    const doctors = await getRows(
      `SELECT user_id FROM users WHERE email = ?`,
      ['doctor@demo.local']
    );

    const departments = await getRows(
      `SELECT department_id
       FROM departments
       WHERE department_name = ?`,
      ['General Medicine']
    );

    if (!doctors.length) {
      throw new Error('Demo Doctor user not found.');
    }

    if (!departments.length) {
      throw new Error('General Medicine department not found.');
    }

    await pool.execute(
      `INSERT INTO doctors
        (user_id, department_id, license_number, specialization)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
        department_id = EXCLUDED.department_id,
        specialization = EXCLUDED.specialization`,
      [
        doctors[0].user_id,
        departments[0].department_id,
        'DEMO-LICENSE',
        'General Medicine'
      ]
    );

console.log('Staff demo user created or updated successfully.');
console.log('Staff login: staff@demo.local');
console.log('Staff demo password: Staff123!');

  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to create demo users:', error.message);
  process.exitCode = 1;
});
