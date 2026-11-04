import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from '../src/db.js';

dotenv.config();

const users = [
    ['Admin', 'Demo Admin', 'admin@demo.local', 'Admin123!'],
    ['Doctor', 'Demo Doctor', 'doctor@demo.local', 'Doctor123!'],
    ['Staff', 'Demo Staff', 'staff@demo.local', 'Staff123!']
];

try {
    for (const [role, name, email, pw] of users) {
        const [[r]] = await pool.query(
            'SELECT role_id FROM roles WHERE role_name=?', [role]
        );
        const hash = await bcrypt.hash(pw, 12);

        await pool.execute(
            'INSERT INTO users(role_id,full_name,email,password_hash) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE role_id=VALUES(role_id),full_name=VALUES(full_name),password_hash=VALUES(password_hash),is_active=TRUE',
            [r.role_id, name, email, hash]
        );
        console.log(email, 'ready');
    }

    const [[d]] = await pool.query(
        "SELECT user_id FROM users WHERE email='doctor@demo.local'"
    );
    await pool.execute(
        "INSERT INTO doctors(user_id,department_id,license_number,specialization) VALUES(?,1,'DEMO-LICENSE','General Medicine') ON DUPLICATE KEY UPDATE department_id=1,specialization='General Medicine'",
        [d.user_id]
    );
} catch (e) {
    console.error(e);
    process.exitCode = 1;
} finally {
    await pool.end();
}