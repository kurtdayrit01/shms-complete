import React, { useCallback, useEffect, useState } from 'react';
import './Appointments.css';

const API = 'http://localhost:4000/api/appointments';

function getToken() {
  return sessionStorage.getItem('token') || '';
}

async function apiRequest(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error('No login token. Please log in again.');
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'The request failed.');
  }

  return data;
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(String(value).replace(' ', 'T'));

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString();
}

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  });

  const [form, setForm] = useState({
  patient_id: '',
  doctor_id: '',
  date: '',
  time: '',
  reason: '',
});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [appointmentRows, patientRows, doctorRows, dashboard] =
        await Promise.all([
          apiRequest('/'),
          apiRequest('/options/patients'),
          apiRequest('/options/doctors'),
          apiRequest('/dashboard'),
        ]);

      setAppointments(appointmentRows);
      setPatients(patientRows);
      setDoctors(doctorRows);
      setCounts(dashboard);
    } catch (err) {
      setError(err.message || 'Unable to load appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      if (!form.patient_id || !form.doctor_id) {
        throw new Error('Please select a patient and doctor.');
      }

      const response = await apiRequest('/', {
  method: 'POST',
  body: JSON.stringify({
  patient_id: Number(form.patient_id),
  doctor_id: Number(form.doctor_id),
  appointment_date: form.date,
  appointment_time: form.time,
  reason: form.reason.trim(),
})
});

setSuccess(
  `Appointment created successfully! Queue Number: ${String(
    response.queue_number
  ).padStart(3, '0')}`
);

      setForm({
  patient_id: '',
  doctor_id: '',
  date: '',
  reason: '',
});

      setSuccess('The appointment was successfully saved to the database.');
      await loadData();
    } catch (err) {
      setError(err.message || 'The appointment could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id, status) {
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      setSuccess(`Appointment status updated to ${status}.`);
      await loadData();
    } catch (err) {
      setError(err.message || 'The status could not be updated.');
    }
  }

    return (
    <main className="appointments-page">
    
      <header className="appointments-header">
        <div>
          <h1>Appointments</h1>
          <p>Schedule and manage patient visits.</p>
        </div>

        <button type="button" onClick={loadData}>
          Refresh
        </button>
      </header>

      {error && (
        <div className="appointment-message appointment-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="appointment-message appointment-success" role="status">
          {success}
        </div>
      )}

      <section className="appointment-dashboard">
        {[
          ['Total Appointments', counts.total],
          ['Pending', counts.pending],
          ['Confirmed', counts.confirmed],
          ['Completed', counts.completed],
          ['Cancelled', counts.cancelled],
        ].map(([label, value]) => (
          <article className="appointment-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="appointment-card">
        <h2>Book an Appointment</h2>

        <form onSubmit={handleSubmit}>
          <div className="appointment-grid">
            <label>
              Patient
              <select
                name="patient_id"
                value={form.patient_id}
                onChange={handleChange}
                required
              >
                <option value="">Select patient</option>
                {patients.map((patient) => (
                  <option
                    key={patient.patient_id}
                    value={patient.patient_id}
                  >
                    {patient.full_name}
                    {patient.patient_code ? ` (${patient.patient_code})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Doctor
              <select
                name="doctor_id"
                value={form.doctor_id}
                onChange={handleChange}
                required
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option
                    key={doctor.doctor_id}
                    value={doctor.doctor_id}
                  >
                    {doctor.doctor_name}
                    {doctor.specialization
                      ? ` — ${doctor.specialization}`
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
  Appointment Date
  <input
    type="date"
    name="date"
    min={new Date().toLocaleDateString('en-CA')}
    value={form.date}
    onChange={handleChange}
    required
  />
</label>

<label>
  Appointment Time
  <input
    type="time"
    name="time"
    value={form.time}
    onChange={handleChange}
    required
  />
</label>

            <label className="full-width">
              Reason for Visit
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                placeholder="Describe the reason for the appointment"
                maxLength={255}
                required
              />
            </label>
          </div>

          <button className="book-button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : '+ Book Appointment'}
          </button>
        </form>
      </section>

      <section className="appointment-card">
        <h2>Appointment List</h2>

        {loading ? (
          <p>Loading appointments...</p>
        ) : appointments.length === 0 ? (
          <p className="empty-state">
            No appointments found in the database.
          </p>
        ) : (
          <div className="appointment-list">
            {appointments.map((appointment) => (
              <article
                className="appointment-item"
                key={appointment.appointment_id}
              >
                <div>
                  <h3>{appointment.patient_name || `Patient #${appointment.patient_id}`}</h3>
                  <p>
                    Doctor: {appointment.doctor_name || `Doctor #${appointment.doctor_id}`}
                  </p>
                  <p>
  Appointment Date: {
    new Date(appointment.appointment_datetime).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    })
  }
</p>

<p>
  Queue Number: <strong>
    {String(appointment.queue_number).padStart(3, '0')}
  </strong>
</p>
                  <p>
  Appointment Type:{' '}
  <strong className={`appointment-type-badge ${
    appointment.appointment_type === 'Video Call'
      ? 'video-call'
      : 'face-to-face'
  }`}>
    {appointment.appointment_type || 'Not specified'}
  </strong>
</p>

<p>Reason: {appointment.reason}</p>
                  <p>
                    Status: <strong>{appointment.status}</strong>
                  </p>
                </div>

                <label>
                  Update status
                  <select
                    value={appointment.status}
                    onChange={(event) =>
                      updateStatus(
                        appointment.appointment_id,
                        event.target.value
                      )
                    }
                  >
                    {['Pending', 'Confirmed', 'Completed', 'Cancelled'].map(
                      (status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
