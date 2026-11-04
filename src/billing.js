
import { Router } from 'express';
import { pool } from './db.js';
import { auth, roles } from './auth.js';

const router = Router();

const canViewBilling = roles('Admin', 'Doctor', 'Staff');
const canManageBilling = roles('Staff');
const paymentMethods = ['Cash', 'Bank Transfer'];

// GET completed appointments without invoices
router.get('/eligible-appointments', auth, canManageBilling, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        a.appointment_id,
        a.appointment_date,
        a.appointment_datetime,
        a.appointment_type,
        a.reason,
        p.patient_id,
        p.full_name AS patient_name,
        d.doctor_id,
        u.full_name AS doctor_name
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN users u ON u.user_id = d.user_id
      LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
      WHERE LOWER(a.status) = 'completed'
        AND i.invoice_id IS NULL
      ORDER BY a.appointment_date DESC, a.appointment_id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Eligible appointments error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET invoice history
router.get('/', auth, canViewBilling, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        i.invoice_id,
        i.patient_id,
        i.appointment_id,
        i.invoice_date,
        i.total_amount,
        i.status,
        p.full_name AS patient_name,
        a.appointment_date,
        COALESCE(
          (SELECT SUM(pay.amount)
           FROM payments pay
           WHERE pay.invoice_id = i.invoice_id),
          0
        ) AS amount_paid
      FROM invoices i
      JOIN patients p ON p.patient_id = i.patient_id
      LEFT JOIN appointments a ON a.appointment_id = i.appointment_id
      ORDER BY i.invoice_id DESC
    `);

    const [items] = await pool.query(`
      SELECT invoice_item_id, invoice_id,
             item_description, quantity, unit_price
      FROM invoice_items
      ORDER BY invoice_item_id
    `);

    const itemMap = new Map();

    for (const item of items) {
      if (!itemMap.has(item.invoice_id)) {
        itemMap.set(item.invoice_id, []);
      }
      itemMap.get(item.invoice_id).push(item);
    }

    res.json(rows.map(invoice => ({
      ...invoice,
      items: itemMap.get(invoice.invoice_id) || [],
      balance: Math.max(
        0,
        Number(invoice.total_amount) - Number(invoice.amount_paid)
      ),
    })));
  } catch (error) {
    console.error('Load invoices error:', error);
    res.status(500).json({ message: error.message });
  }
});

// CREATE invoice
router.post('/', auth, canManageBilling, async (req, res) => {
  const appointmentId = Number(req.body.appointment_id);
  const items = req.body.items;

  if (!Number.isSafeInteger(appointmentId) || appointmentId < 1) {
    return res.status(400).json({ message: 'Invalid appointment.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Add at least one invoice item.' });
  }

  let total = 0;

  for (const item of items) {
    const description = String(item.item_description || '').trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);

    if (
      !description ||
      description.length > 255 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      return res.status(400).json({
        message: 'Check invoice descriptions, quantities, and prices.',
      });
    }

    total += quantity * unitPrice;
  }

  if (!Number.isFinite(total) || total <= 0) {
    return res.status(400).json({
      message: 'Invoice total must be greater than zero.',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [appointments] = await connection.query(`
      SELECT appointment_id, patient_id, status
      FROM appointments
      WHERE appointment_id = ?
      FOR UPDATE
    `, [appointmentId]);

    if (!appointments.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const appointment = appointments[0];

    if (String(appointment.status).toLowerCase() !== 'completed') {
      await connection.rollback();
      return res.status(400).json({
        message: 'Only completed appointments can be invoiced.',
      });
    }

    const [existing] = await connection.query(
      'SELECT invoice_id FROM invoices WHERE appointment_id = ?',
      [appointmentId]
    );

    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({
        message: 'This appointment already has an invoice.',
      });
    }

    const [invoiceResult] = await connection.query(`
      INSERT INTO invoices
        (patient_id, appointment_id, invoice_date, total_amount, status)
      VALUES (?, ?, CURRENT_DATE, ?, 'Unpaid')
    `, [appointment.patient_id, appointmentId, total]);

    const invoiceId = invoiceResult.insertId;

    for (const item of items) {
      await connection.query(`
        INSERT INTO invoice_items
          (invoice_id, item_description, quantity, unit_price)
        VALUES (?, ?, ?, ?)
      `, [
        invoiceId,
        String(item.item_description).trim(),
        Number(item.quantity),
        Number(item.unit_price),
      ]);
    }

    await connection.commit();

    res.status(201).json({
      message: 'Invoice created successfully.',
      invoice_id: invoiceId,
      total_amount: total,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Invoice rollback error:', rollbackError);
      }
    }

    console.error('Create invoice error:', error);
    res.status(500).json({ message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// RECORD payment
router.post('/:id/payments', auth, canManageBilling, async (req, res) => {
  const invoiceId = Number(req.params.id);
  const amount = Number(req.body.amount);
  const method = req.body.payment_method;
  const reference = typeof req.body.reference_number === 'string'
    ? req.body.reference_number.trim()
    : null;

  if (
    !Number.isSafeInteger(invoiceId) ||
    invoiceId < 1 ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !paymentMethods.includes(method) ||
    (reference && reference.length > 120)
  ) {
    return res.status(400).json({
      message: 'Enter a valid payment amount and method.',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [invoices] = await connection.query(`
      SELECT invoice_id, total_amount
      FROM invoices
      WHERE invoice_id = ?
      FOR UPDATE
    `, [invoiceId]);

    if (!invoices.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Invoice not found.' });
    }

    const [paymentRows] = await connection.query(`
      SELECT COALESCE(SUM(amount), 0) AS amount_paid
      FROM payments
      WHERE invoice_id = ?
    `, [invoiceId]);

    const total = Number(invoices[0].total_amount);
    const paid = Number(paymentRows[0].amount_paid || 0);
    const balance = total - paid;

    if (balance <= 0.001 || amount > balance + 0.001) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Payment exceeds the remaining balance or invoice is already paid.',
      });
    }

    await connection.query(`
      INSERT INTO payments
        (invoice_id, amount, payment_method, reference_number)
      VALUES (?, ?, ?, ?)
    `, [invoiceId, amount, method, reference]);

    const newPaid = paid + amount;
    const newBalance = Math.max(0, total - newPaid);
    const status = newBalance <= 0.001 ? 'Paid' : 'Partially Paid';

    await connection.query(
      'UPDATE invoices SET status = ? WHERE invoice_id = ?',
      [status, invoiceId]
    );

    await connection.commit();

    res.json({
      message: 'Payment recorded successfully.',
      amount_paid: newPaid,
      balance: newBalance,
      status,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Payment rollback error:', rollbackError);
      }
    }

    console.error('Record payment error:', error);
    res.status(500).json({ message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

export default router;
