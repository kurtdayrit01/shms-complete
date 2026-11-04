
import { Router } from 'express';
import { pool } from './db.js';
import { auth, roles } from './auth.js';

const router = Router();

const allowedStatuses = [
  'Pending',
  'Confirmed',
  'Completed',
  'Cancelled',
];

const canRead = roles('Admin', 'Doctor', 'Staff');
const canManage = roles('Admin', 'Doctor', 'Staff');

function isValidDateTime(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)
  ) {
    return false;
  }

  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second = 0] = timePart.split(':').map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    hour >= 0 && hour <= 23 &&
    minute >= 0 && minute <= 59 &&
    second >= 0 && second <= 59
  );
}

function toDatabaseDateTime(value) {
  const formatted = value.replace('T', ' ');
  return formatted.length === 16 ? `${formatted}:00` : formatted;
}



function isValidDateOnly(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isNotPastDate(value) {
  const now = new Date();
  const today =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return value >= today;
}


// Dashboard counts for Admin, Doctor, and Staff
// Dashboard counts for Admin, Doctor, and Staff
router.get('/dashboard', auth, canRead, async (req, res) => {
  try {
    let query = `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN a.status = 'Pending' THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN a.status = 'Confirmed' THEN 1 ELSE 0 END), 0) AS confirmed,
        COALESCE(SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END), 0) AS completed,
        COALESCE(SUM(CASE WHEN a.status = 'Cancelled' THEN 1 ELSE 0 END), 0) AS cancelled
      FROM appointments a
    `;

    let params = [];

    if (req.user.role === 'Doctor') {
      query += `
        JOIN doctors d ON d.doctor_id = a.doctor_id
        WHERE d.user_id = ?
      `;
      params.push(req.user.userId);
    }

    const [rows] = await pool.query(query, params);
    const row = rows[0] || {};

    res.json({
      total: Number(row.total || 0),
      pending: Number(row.pending || 0),
      confirmed: Number(row.confirmed || 0),
      completed: Number(row.completed || 0),
      cancelled: Number(row.cancelled || 0),
    });
  } catch (error) {
    console.error('Appointment dashboard error:', error);
    res.status(500).json({
      message: 'Failed to load appointment dashboard.',
    });
  }
});
// Patient appointment history
router.get('/mine', auth, roles('Patient'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        a.appointment_id,
        a.patient_id,
        p.patient_code,
        p.full_name AS patient_name,
        a.doctor_id,
        u.full_name AS doctor_name,
        a.appointment_datetime,
        a.status,
        a.reason,
        a.created_at
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN users u ON u.user_id = d.user_id
      WHERE p.user_id = ?
      ORDER BY a.appointment_datetime DESC
      `,
      [req.user.userId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Patient appointments error:', error);
    res.status(500).json({
      message: 'Failed to load your appointments.',
    });
  }
});


// Patient cancel own appointment
router.patch('/:id/cancel', auth, roles('Patient'), async (req, res) => {
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({
      message: 'Invalid appointment ID'
    });
  }

  try {
    const [appointments] = await pool.query(
      `SELECT a.appointment_id, a.status
       FROM appointments a
       JOIN patients p ON p.patient_id = a.patient_id
       WHERE a.appointment_id = ?
         AND p.user_id = ?`,
      [appointmentId, req.user.userId]
    );

    if (!appointments.length) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    if (!['Pending', 'Confirmed'].includes(appointments[0].status)) {
      return res.status(400).json({
        message: 'Only Pending or Confirmed appointments can be cancelled'
      });
    }

    const [result] = await pool.execute(
      `UPDATE appointments
       SET status = 'Cancelled'
       WHERE appointment_id = ?
         AND status IN ('Pending', 'Confirmed')`,
      [appointmentId]
    );

    if (!result.affectedRows) {
      return res.status(409).json({
        message: 'Appointment status has already changed. Please refresh.'
      });
    }

    return res.json({
      success: true,
      message: 'Appointment cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel appointment error:', error);
    return res.status(500).json({
      message: 'Failed to cancel appointment'
    });
  }
});


// Appointment list for Admin, Doctor, and Staff
// Appointment list for Admin, Doctor, and Staff
// Appointment list for Admin, Doctor, and Staff
router.get('/', auth, canRead, async (req, res) => {
  try {
    let query = `
      SELECT
        a.appointment_id,
        a.patient_id,
        p.patient_code,
        p.full_name AS patient_name,
        a.doctor_id,
        u.full_name AS doctor_name,
        a.appointment_datetime,
        a.appointment_type,
        a.appointment_date,
        a.queue_number,
        a.status,
        a.reason,
        a.created_at
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN users u ON u.user_id = d.user_id
    `;

    let params = [];

    if (req.user.role === 'Doctor') {
      query += ` WHERE d.user_id = ?`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY a.appointment_datetime DESC`;

    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      message: 'Failed to retrieve appointments.',
    });
  }
});

// Patient options for Admin, Doctor, and Staff
router.get('/options/patients', auth, canRead, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT patient_id, patient_code, full_name
      FROM patients
      ORDER BY full_name
    `);

    res.json(rows);
  } catch (error) {
    console.error('Load patients error:', error);
    res.status(500).json({
      message: 'Failed to load patients.',
    });
  }
});

// Doctor options for Admin, Doctor, and Staff
router.get('/options/doctors', auth, canRead, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        d.doctor_id,
        u.full_name AS doctor_name,
        d.specialization
      FROM doctors d
      JOIN users u ON u.user_id = d.user_id
      ORDER BY u.full_name
    `);

    res.json(rows);
  } catch (error) {
    console.error('Load doctors error:', error);
    res.status(500).json({
      message: 'Failed to load doctors.',
    });
  }
});

// Doctors available to the logged-in patient
router.get(
  '/options/patient-doctors',
  auth,
  roles('Patient'),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          d.doctor_id,
          u.full_name AS doctor_name,
          d.specialization
        FROM doctors d
        JOIN users u ON u.user_id = d.user_id
        ORDER BY u.full_name
      `);

      res.json(rows);
    } catch (error) {
      console.error('Load patient doctors error:', error);
      res.status(500).json({
        message: 'Failed to load doctors.',
      });
    }
  }
);


// Available dates and 30-minute slots for patient booking
router.get(
  '/patient/availability',
  auth,
  roles('Patient'),
  async (req, res) => {
    try {
      const doctorId = Number(req.query.doctor_id);
      const month = req.query.month;

      if (
        !Number.isSafeInteger(doctorId) ||
        doctorId < 1 ||
        typeof month !== 'string' ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ) {
        return res.status(400).json({
          message: 'Please provide a valid doctor and month.',
        });
      }

      // Get doctor's working schedule
      const [schedules] = await pool.query(
        `SELECT day_of_week, start_time, end_time
         FROM doctor_schedules
         WHERE doctor_id = ?`,
        [doctorId]
      );

      if (!schedules.length) {
        return res.json({ available_dates: [] });
      }

      const [year, monthNumber] = month.split('-').map(Number);
      const daysInMonth = new Date(year, monthNumber, 0).getDate();

      const firstDate = `${month}-01`;
      const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1))
        .toISOString()
        .slice(0, 10);

      // Get existing bookings for this doctor and month
      const [bookings] = await pool.query(
        `SELECT
           appointment_date::text AS appointment_date,
           TO_CHAR(appointment_datetime, 'HH24:MI') AS appointment_time
         FROM appointments
         WHERE doctor_id = ?
           AND appointment_date >= ?
           AND appointment_date < ?
           AND status <> 'Cancelled'`,
        [doctorId, firstDate, nextMonthDate]
      );

      const bookedSlots = new Set(
        bookings.map(
          (booking) =>
            `${booking.appointment_date}|${booking.appointment_time}`
        )
      );

      // Current date and time in Philippine time
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date());

      const getPart = (type) =>
        parts.find((part) => part.type === type).value;

      const today =
        `${getPart('year')}-${getPart('month')}-${getPart('day')}`;

      const currentMinutes =
        Number(getPart('hour')) * 60 + Number(getPart('minute'));

      const weekdays = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];

      const availableDates = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${month}-${String(day).padStart(2, '0')}`;

        if (date < today) continue;

        const weekday = weekdays[
          new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay()
        ];

        const daySchedules = schedules.filter(
          (schedule) =>
            schedule.day_of_week.toLowerCase() === weekday.toLowerCase()
        );

        const availableSlots = [];

        for (const schedule of daySchedules) {
          const [startHour, startMinute] =
            schedule.start_time.slice(0, 5).split(':').map(Number);

          const [endHour, endMinute] =
            schedule.end_time.slice(0, 5).split(':').map(Number);

          const start = startHour * 60 + startMinute;
          const end = endHour * 60 + endMinute;

          for (
            let slot = start;
            slot + 30 <= end;
            slot += 30
          ) {
            const hour = String(Math.floor(slot / 60)).padStart(2, '0');
            const minute = String(slot % 60).padStart(2, '0');
            const time = `${hour}:${minute}`;

            if (date === today && slot <= currentMinutes) {
              continue;
            }

            if (!bookedSlots.has(`${date}|${time}`)) {
              availableSlots.push(time);
            }
          }
        }

        if (availableSlots.length > 0) {
          availableDates.push({
            date,
            day: weekday,
            slots: [...new Set(availableSlots)].sort(),
          });
        }
      }

      return res.json({
        available_dates: availableDates,
      });

    } catch (error) {
      console.error('Patient availability error:', error);

      return res.status(500).json({
        message: 'Failed to load available appointment slots.',
      });
    }
  }
);



// Admin, Doctor, or Staff creates an appointment for a patient

router.post('/', auth, canManage, async (req, res) => {
  const patientId = Number(req.body.patient_id);
  const doctorId = Number(req.body.doctor_id);
  const appointmentDate = req.body.appointment_date;
  const appointmentTime = req.body.appointment_time;
  const validTime =
  typeof appointmentTime === 'string' &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime);
  const reason = typeof req.body.reason === 'string'
    ? req.body.reason.trim()
    : '';

 if (
  !Number.isSafeInteger(patientId) || patientId < 1 ||
  !Number.isSafeInteger(doctorId) || doctorId < 1 ||
  !isValidDateOnly(appointmentDate) ||
  !isNotPastDate(appointmentDate) ||
  !validTime ||
  !reason ||
  reason.length > 255
) {
    return res.status(400).json({
      message: 'Provide a valid patient, doctor, date, and reason (maximum 255 characters).',
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [doctors] = await connection.execute(
      `SELECT doctor_id
       FROM doctors
       WHERE doctor_id = ?
       FOR UPDATE`,
      [doctorId]
    );

    if (!doctors.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        message: 'Selected doctor does not exist.',
      });
    }

    const [patients] = await connection.execute(
      `SELECT patient_id
       FROM patients
       WHERE patient_id = ?`,
      [patientId]
    );

    if (!patients.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        message: 'Selected patient does not exist.',
      });
    }

    const [countRows] = await connection.execute(
      `SELECT COUNT(*)::int AS total
       FROM appointments
       WHERE doctor_id = ?
         AND appointment_date = ?
         AND status <> 'Cancelled'`,
      [doctorId, appointmentDate]
    );

    const currentBookings = Number(countRows[0].total);

    if (currentBookings >= 15) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        message: 'This doctor is fully booked for the selected date.',
      });
    }

    const [queueRows] = await connection.execute(
      `SELECT COALESCE(MAX(queue_number), 0)::int + 1 AS next_queue
       FROM appointments
       WHERE doctor_id = ?
         AND appointment_date = ?`,
      [doctorId, appointmentDate]
    );

    const queueNumber = Number(queueRows[0].next_queue);

    const [result] = await connection.execute(
      `INSERT INTO appointments
        (
          patient_id,
          doctor_id,
          appointment_datetime,
          appointment_date,
          queue_number,
          reason,
          status
        )
       VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        patientId,
        doctorId,
        `${appointmentDate} ${appointmentTime}:00`,
        appointmentDate,
        queueNumber,
        reason,
      ]
    );

    const [rows] = await connection.execute(
      `SELECT *
       FROM appointments
       WHERE appointment_id = ?`,
      [result.insertId]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json(rows[0]);

  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error('Create appointment error:', error);
    return res.status(500).json({
      message: 'Failed to save appointment.',
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// Update appointment details or status
router.patch('/:id', auth, canManage, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      message: 'Invalid appointment ID.',
    });
  }

  const allowedFields = [
    'patient_id',
    'doctor_id',
    'appointment_datetime',
    'reason',
    'status',
  ];

  const updates = {};

  for (const field of allowedFields) {
    if (Object.hasOwn(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({
      message: 'No changes provided.',
    });
    // Doctors can only update the status of their own appointments
if (req.user.role === 'Doctor') {
  const hasOtherFields = Object.keys(updates).some(
    (field) => field !== 'status'
  );

  if (hasOtherFields) {
    return res.status(403).json({
      message: 'Doctors can only update appointment status.',
    });
  }
}
  }

  if (
    updates.status !== undefined &&
    !allowedStatuses.includes(updates.status)
  ) {
    return res.status(400).json({
      message: 'Invalid appointment status.',
    });
  }

  if (
    updates.reason !== undefined &&
    (
      typeof updates.reason !== 'string' ||
      !updates.reason.trim() ||
      updates.reason.trim().length > 255
    )
  ) {
    return res.status(400).json({
      message: 'Reason is required and must not exceed 255 characters.',
    });
  }

  if (updates.patient_id !== undefined) {
    const patientId = Number(updates.patient_id);

    if (!Number.isSafeInteger(patientId) || patientId < 1) {
      return res.status(400).json({
        message: 'Invalid patient ID.',
      });
    }

    updates.patient_id = patientId;
  }

  if (updates.doctor_id !== undefined) {
    const doctorId = Number(updates.doctor_id);

    if (!Number.isSafeInteger(doctorId) || doctorId < 1) {
      return res.status(400).json({
        message: 'Invalid doctor ID.',
      });
    }

    updates.doctor_id = doctorId;
  }

  if (updates.appointment_datetime !== undefined) {
    if (!isValidDateTime(updates.appointment_datetime)) {
      return res.status(400).json({
        message: 'Invalid appointment date/time.',
      });
    }

    updates.appointment_datetime = toDatabaseDateTime(
      updates.appointment_datetime
    );
  }

  try {
    if (updates.patient_id !== undefined) {
      const [rows] = await pool.execute(
        'SELECT patient_id FROM patients WHERE patient_id = ?',
        [updates.patient_id]
      );

      if (!rows.length) {
        return res.status(400).json({
          message: 'Selected patient does not exist.',
        });
      }
    }

    if (updates.doctor_id !== undefined) {
      const [rows] = await pool.execute(
        'SELECT doctor_id FROM doctors WHERE doctor_id = ?',
        [updates.doctor_id]
      );

      if (!rows.length) {
        return res.status(400).json({
          message: 'Selected doctor does not exist.',
        });
      }
    }

    const columns = Object.keys(updates);
    const values = columns.map((field) => (
      field === 'reason' ? updates[field].trim() : updates[field]
    ));

    let updateQuery = `
  UPDATE appointments
  SET ${columns.map((field) => `${field} = ?`).join(', ')}
  WHERE appointment_id = ?
`;

let updateValues = [...values, id];

if (req.user.role === 'Doctor') {
  updateQuery += `
    AND doctor_id = (
      SELECT doctor_id
      FROM doctors
      WHERE user_id = ?
    )
  `;

  updateValues.push(req.user.userId);
}

const [result] = await pool.execute(
  updateQuery,
  updateValues
);

   if (!result.affectedRows) {

  if (req.user.role === 'Doctor') {
    return res.status(404).json({
      message: 'Appointment not found or not assigned to you.',
    });
  }

  const [existing] = await pool.execute(
    'SELECT appointment_id FROM appointments WHERE appointment_id = ?',
    [id]
  );

  if (!existing.length) {
    return res.status(404).json({
      message: 'Appointment not found.',
    });
  }
}
    const [rows] = await pool.execute(
      'SELECT * FROM appointments WHERE appointment_id = ?',
      [id]
    );

    return res.json(rows[0]);
  } catch (error) {
    console.error('Update appointment error:', error);
    return res.status(500).json({
      message: 'Failed to update appointment.',
    });
  }
});



// Patient FCFS Booking Route
router.post('/patient/book', auth, roles('Patient'), async (req, res) => {
  const doctorId = Number(req.body.doctor_id);
  const appointmentDate = req.body.appointment_date;
  const appointmentTime = req.body.appointment_time;
  const appointmentType = req.body.appointment_type;

  const reason = typeof req.body.reason === 'string'
    ? req.body.reason.trim()
    : '';

  const validTypes = ['Face-to-Face', 'Video Call'];

  const validTime =
    typeof appointmentTime === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime);

  // Validate booking information
  if (
    !Number.isSafeInteger(doctorId) ||
    doctorId < 1 ||
    !isValidDateOnly(appointmentDate) ||
    !isNotPastDate(appointmentDate) ||
    !validTypes.includes(appointmentType) ||
    !validTime ||
    !reason ||
    reason.length > 255
  ) {
    return res.status(400).json({
      message: 'Please provide a valid doctor, appointment type, date, time, and reason.',
    });
  }

  // Get current Philippine date and time
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const getPart = (type) =>
    parts.find((part) => part.type === type).value;

  const today =
    `${getPart('year')}-${getPart('month')}-${getPart('day')}`;

  const currentMinutes =
    Number(getPart('hour')) * 60 + Number(getPart('minute'));

  const [selectedHour, selectedMinute] =
    appointmentTime.split(':').map(Number);

  const selectedMinutes =
    selectedHour * 60 + selectedMinute;

  // Reject past appointment dates and times
  if (
    appointmentDate < today ||
    (appointmentDate === today && selectedMinutes <= currentMinutes)
  ) {
    return res.status(400).json({
      message: 'Please select a future appointment time.',
    });
  }

  // Determine selected weekday
  const weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  const [year, month, day] = appointmentDate.split('-').map(Number);

  const weekday = weekdays[
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Lock doctor row to prevent simultaneous bookings
    const [doctors] = await connection.execute(
      `SELECT doctor_id
       FROM doctors
       WHERE doctor_id = ?
       FOR UPDATE`,
      [doctorId]
    );

    if (!doctors.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: 'Selected doctor not found.',
      });
    }

    // Check patient profile
    const [patients] = await connection.execute(
      `SELECT patient_id
       FROM patients
       WHERE user_id = ?`,
      [req.user.userId]
    );

    if (!patients.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: 'Patient profile not found.',
      });
    }

    // Check doctor's working schedule
    const [schedules] = await connection.execute(
      `SELECT start_time, end_time
       FROM doctor_schedules
       WHERE doctor_id = ?
       AND LOWER(day_of_week) = LOWER(?)`,
      [doctorId, weekday]
    );

    if (!schedules.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message: 'The doctor is not available on this day.',
      });
    }

    // Validate 30-minute appointment slot
    const validSchedule = schedules.some((schedule) => {
      const [startHour, startMinute] =
        schedule.start_time.slice(0, 5).split(':').map(Number);

      const [endHour, endMinute] =
        schedule.end_time.slice(0, 5).split(':').map(Number);

      const start = startHour * 60 + startMinute;
      const end = endHour * 60 + endMinute;

      return (
        selectedMinutes >= start &&
        selectedMinutes + 30 <= end &&
        (selectedMinutes - start) % 30 === 0
      );
    });

    if (!validSchedule) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message: 'The selected time is outside the doctor schedule.',
      });
    }

    // Check if selected slot is already booked
    const [existingBookings] = await connection.execute(
      `SELECT appointment_id
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND TO_CHAR(appointment_datetime, 'HH24:MI') = ?
       AND status <> 'Cancelled'`,
      [doctorId, appointmentDate, appointmentTime]
    );

    if (existingBookings.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message: 'This time slot is no longer available. Please select another time.',
      });
    }

    // Check daily appointment limit
    const [countRows] = await connection.execute(
      `SELECT COUNT(*)::int AS total
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND status <> 'Cancelled'`,
      [doctorId, appointmentDate]
    );

    if (Number(countRows[0].total) >= 15) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message: 'This doctor is fully booked for this date.',
      });
    }

    // Generate FCFS queue number
    const [queueRows] = await connection.execute(
      `SELECT COALESCE(MAX(queue_number), 0)::int + 1 AS next_queue
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?`,
      [doctorId, appointmentDate]
    );

    const queueNumber = Number(queueRows[0].next_queue);

    // Combine appointment date and time
    const appointmentDateTime =
      `${appointmentDate} ${appointmentTime}:00`;

    // Insert appointment
    const [result] = await connection.execute(
      `INSERT INTO appointments (
        patient_id,
        doctor_id,
        appointment_datetime,
        appointment_date,
        appointment_type,
        queue_number,
        reason,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        patients[0].patient_id,
        doctorId,
        appointmentDateTime,
        appointmentDate,
        appointmentType,
        queueNumber,
        reason,
      ]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      message: 'Appointment booked successfully.',
      appointment_id: result.insertId,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      appointment_type: appointmentType,
      queue_number: queueNumber,
    });

  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error('Patient booking error:', error);

    return res.status(500).json({
      message: 'Failed to submit appointment request.',
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});




export default router;

