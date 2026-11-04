import Appointments from './Appointments';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import Billing from './billing';
import PatientBookAppointment from './PatientBookAppointment';
import PatientAI from './PatientAI';

const API = 'http://localhost:4000/api';

// =====================================================
// AUTH HELPERS
// =====================================================

const token = () => sessionStorage.getItem('token') || '';

const user = () => JSON.parse(sessionStorage.getItem('user') || 'null');
// =====================================================
// API HELPER
// =====================================================

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token()) {
    headers.Authorization = 'Bearer ' + token();
  }

  const response = await fetch(API + path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Error(data.message || 'Request failed');
  }

  return data;
}
async function uploadProfilePicture(file) {
  const formData = new FormData();
  formData.append('profile', file);

  const response = await fetch(`${API}/patient/profile-picture`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token(),
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Profile picture upload failed.');
  }

  return data;
}
// =====================================================
// LOGIN
// =====================================================



function Login({ done }) {
  const [isRegister, setIsRegister] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  // Patient Registration
  const [isPatientRegister, setIsPatientRegister] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isRegister) return;

    api('/public/departments')
      .then(setDepartments)
      .catch((err) => setError(err.message));
  }, [isRegister]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isRegister || isPatientRegister) {
        if (password.length < 8) {
          throw Error('Password must be at least 8 characters.');
        }

        if (password !== confirmPassword) {
          throw Error('Passwords do not match.');
        }

        
const result = await api(
  isPatientRegister
    ? '/auth/register-patient'
    : '/auth/register',
  {
    method: 'POST',
    body: JSON.stringify(
      isPatientRegister
        ? {
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
            birth_date: birthDate || null,
            sex: sex || null,
            contact_number: contactNumber.trim(),
            address: address.trim(),
          }
        : {
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
            license_number: licenseNumber.trim(),
            specialization: specialization.trim(),
            department_id: Number(departmentId),
          }
    ),
  }
);


        setIsRegister(false);
        setPassword('');
        setConfirmPassword('');
        setFullName('');
        setLicenseNumber('');
        setSpecialization('');
        setDepartmentId('');
        setMessage(
          result.message || 'Doctor account created. You can now sign in.'
        );
      } else {
        const data = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        });

        sessionStorage.setItem('token', data.token);
sessionStorage.setItem('user', JSON.stringify(data.user));
        done(data.user);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={handleSubmit}>
        <h1>Smart Healthcare</h1>

        <p>
          {isRegister
            ? 'Doctor Registration'
            : 'Healthcare Management System'}
        </p>

       {(isRegister || isPatientRegister) && (
          <>
            <input 
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              maxLength={120}
              required
            />
{!isPatientRegister && (
  <>
            <input
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="Professional license number"
              maxLength={60}
              required
            />

            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="Specialization"
              maxLength={100}
              required
            />

            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              required
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option
                  key={department.department_id}
                  value={department.department_id}
                >
                  {department.department_name}
                </option>
              ))}
            </select>
              </>
           )}
          </>
        )}

       
{isPatientRegister && (
  <>
    <input
      type="date"
      value={birthDate}
      onChange={(e) => setBirthDate(e.target.value)}
      required
    />

    <select
      value={sex}
      onChange={(e) => setSex(e.target.value)}
      required
    >
      <option value="">Select sex</option>
      <option value="Male">Male</option>
      <option value="Female">Female</option>
    </select>

    <input
      type="tel"
      value={contactNumber}
      onChange={(e) => setContactNumber(e.target.value)}
      placeholder="Contact number"
    />

    <input
      type="text"
      value={address}
      onChange={(e) => setAddress(e.target.value)}
      placeholder="Address"
    />
  </>
)}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
          maxLength={160}
          required
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (at least 8 characters)"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          minLength={isRegister ? 8 : undefined}
          required
        />

       {(isRegister || isPatientRegister) && (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        )}

        {message && <p className="success">{message}</p>}
        {error && <p className="err">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading
            ? 'Please wait...'
            : isPatientRegister
          ? 'Register as Patient'
          : isPatientRegister
           ? 'Register as Patient'
          : isRegister
           ? 'Register as Doctor'
           : 'Sign in'}
        </button>

        <p>
          {isRegister
            ? 'Already have an account?'
            : "Don't have an account?"}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
           if (isPatientRegister) {
            setIsPatientRegister(false);
         } else {
          setIsRegister(!isRegister);
         }
           setError('');
          setMessage('');
           }}
          >
            {isPatientRegister
            ? 'Sign in'
           : isRegister
          ? 'Sign in'
          : 'Register as Doctor'}
          </button>
        </p>
        <button
       type="button"
      className="link-button"
      onClick={() => {
        setIsPatientRegister(true);
        setIsRegister(false);
        setError('');
       setMessage('');
       }}
       >
       Register as Patient
</button>
      </form>
    </div>
  );
}


function PatientDashboard({ me, onNavigate }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api('/appointments/mine')
      .then((data) => {
        if (!active) return;

        const records = Array.isArray(data)
          ? data
          : Array.isArray(data?.appointments)
            ? data.appointments
            : [];

        setAppointments(records);
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Unable to load appointments.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const now = new Date();

  const upcoming = appointments.filter((item) => {
    const date = new Date(
      String(item.appointment_datetime || item.appointment_date || '')
        .replace(' ', 'T')
    );

    const status = String(item.status || '').toLowerCase();

    return (
      !Number.isNaN(date.getTime()) &&
      date >= now &&
      !['cancelled', 'completed', 'rejected'].includes(status)
    );
  });

  const pending = appointments.filter(
    (item) => String(item.status || '').toLowerCase() === 'pending'
  );

  const completed = appointments.filter(
    (item) => String(item.status || '').toLowerCase() === 'completed'
  );

  const nextAppointment = [...upcoming].sort(
    (a, b) =>
      new Date(a.appointment_datetime || a.appointment_date) -
      new Date(b.appointment_datetime || b.appointment_date)
  )[0];

  const getAppointmentDate = (item) => {
    const value = item?.appointment_datetime || item?.appointment_date;

    if (!value) return 'Date not available';

    const date = new Date(String(value).replace(' ', 'T'));

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const firstName = String(me?.name || 'Patient').trim().split(/\s+/)[0];

  const goTo = (page) => {
    if (onNavigate) onNavigate(page);
  };

  return (
    <section className="patient-home">

      <div className="patient-home-welcome">
        <div>
          <span className="patient-home-eyebrow">
            PATIENT PORTAL
          </span>

          <h1>Welcome back, {firstName}!</h1>

          <p>
            Manage your appointments and access your healthcare services.
          </p>
        </div>

        <div className="patient-home-avatar">
          {firstName.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="patient-home-stats">

        <div className="patient-home-stat">
          <span className="patient-home-stat-icon">📅</span>
          <div>
            <small>Total Appointments</small>
            <h2>{appointments.length}</h2>
          </div>
        </div>

        <div className="patient-home-stat">
          <span className="patient-home-stat-icon">🕒</span>
          <div>
            <small>Upcoming</small>
            <h2>{upcoming.length}</h2>
          </div>
        </div>

        <div className="patient-home-stat">
          <span className="patient-home-stat-icon">⏳</span>
          <div>
            <small>Pending</small>
            <h2>{pending.length}</h2>
          </div>
        </div>

        <div className="patient-home-stat">
          <span className="patient-home-stat-icon">✓</span>
          <div>
            <small>Completed</small>
            <h2>{completed.length}</h2>
          </div>
        </div>

      </div>

      <div className="patient-home-main-grid">

        <div className="patient-home-panel">
          <div className="patient-home-panel-heading">
            <div>
              <h2>Upcoming Appointment</h2>
              <p>Your next scheduled visit</p>
            </div>

            <button
              className="patient-home-text-button"
              onClick={() => goTo('My Appointments')}
            >
              View All
            </button>
          </div>

          {loading ? (
            <p className="patient-home-empty">Loading appointments...</p>
          ) : error ? (
            <p className="patient-home-error">{error}</p>
          ) : nextAppointment ? (
            <div className="patient-home-next">
              <div className="patient-home-calendar">
                <span>📅</span>
              </div>

              <div className="patient-home-next-info">
                <h3>
                  {nextAppointment.doctor_name
                    ? `Dr. ${nextAppointment.doctor_name}`
                    : 'Doctor Appointment'}
                </h3>

                <p>
                  {nextAppointment.specialization || 'Medical Consultation'}
                </p>

                <p className="patient-home-date">
                  {getAppointmentDate(nextAppointment)}
                </p>

                <span className={`patient-home-status ${
                  String(nextAppointment.status || 'pending').toLowerCase()
                }`}>
                  {nextAppointment.status || 'Pending'}
                </span>
              </div>
            </div>
          ) : (
            <div className="patient-home-empty">
              <span>📅</span>
              <h3>No upcoming appointments</h3>
              <p>Book an appointment when you need a consultation.</p>

              <button
                className="patient-home-primary-button"
                onClick={() => goTo('Book Appointment')}
              >
                Book Appointment
              </button>
            </div>
          )}
        </div>

        <div className="patient-home-panel">
          <div className="patient-home-panel-heading">
            <div>
              <h2>Quick Access</h2>
              <p>Frequently used services</p>
            </div>
          </div>

          <div className="patient-home-quick-grid">

            <button onClick={() => goTo('Book Appointment')}>
              <span>📅</span>
              <strong>Book Appointment</strong>
              <small>Schedule a visit</small>
            </button>

            <button onClick={() => goTo('My Appointments')}>
              <span>🗓️</span>
              <strong>My Appointments</strong>
              <small>View your schedule</small>
            </button>

            <button onClick={() => goTo('Medicine Information')}>
              <span>💊</span>
              <strong>Medicine Information</strong>
              <small>View medicine guide</small>
            </button>

            <button onClick={() => goTo('My Profile')}>
              <span>👤</span>
              <strong>My Profile</strong>
              <small>Manage your details</small>
            </button>

          </div>
        </div>

      </div>

      <div className="patient-home-panel patient-home-features">
        <div className="patient-home-panel-heading">
          <div>
            <h2>Healthcare Services</h2>
            <p>Available and planned patient services</p>
          </div>
        </div>

        <div className="patient-home-feature-grid">

          <div className="patient-home-feature available">
            <span>💊</span>
            <div>
              <strong>Medicine Information</strong>
              <small>General medicine reference</small>
            </div>
            <span className="patient-home-feature-label">Available</span>
          </div>

          <div className="patient-home-feature">
            <span>🧪</span>
            <div>
              <strong>Lab Results & Reports</strong>
              <small>View laboratory results</small>
            </div>
            <span className="patient-home-feature-label">Coming Soon</span>
          </div>

          <div className="patient-home-feature">
            <span>📋</span>
            <div>
              <strong>My Prescriptions</strong>
              <small>View prescribed medicines</small>
            </div>
            <span className="patient-home-feature-label">Coming Soon</span>
          </div>

          <div className="patient-home-feature">
            <span>📁</span>
            <div>
              <strong>Medical History</strong>
              <small>Access medical records</small>
            </div>
            <span className="patient-home-feature-label">Coming Soon</span>
          </div>

          <div className="patient-home-feature">
            <span>⚕️</span>
            <div>
              <strong>Allergies</strong>
              <small>Patient allergy information</small>
            </div>
            <span className="patient-home-feature-label">Coming Soon</span>
          </div>

          <div className="patient-home-feature">
            <span>🖥️</span>
            <div>
              <strong>Telehealth</strong>
              <small>Online consultation</small>
            </div>
            <span className="patient-home-feature-label">Coming Soon</span>
          </div>

          <div className="patient-home-feature">
            <span>💬</span>
            <div>
              <strong>Secure Messaging</strong>
              <small>Contact healthcare staff</small>
            </div>
            <span className="patient-home-feature-label">Coming Soon</span>
          </div>

          <div className="patient-home-feature">
            <span>📝</span>
            <div>
              <strong>Doctor's Notes</strong>
              <small>Consultation notes</small>
            </div>
            <span className="patient-home-feature-label">Coming Soon</span>
          </div>

          <div className="patient-home-feature">
            <span>💳</span>
            <div>
              <strong>Billing & Payments</strong>
              <small>Manage healthcare bills</small>
            </div>
            <span className="patient-home-feature-label">Coming Soon</span>
          </div>

          <div className="patient-home-feature">
            <span>📄</span>
            <div>
              <strong>Insurance Claims</strong>
              <small>Insurance information</small>
            </div>
            <span className="patient-home-feature-label">Coming Soon</span>
          </div>

        </div>

        <p className="patient-home-disclaimer">
          Medicine Information is a general reference only. It does not
          represent your personal prescription or medical advice.
        </p>
      </div>

            <div className="patient-home-footer">
        <span>SHMS — Smart Healthcare Management System</span>
        <span>Patient Portal</span>
      </div>

      <PatientAI />

    </section>
  );
}


function PatientAppointments({ me }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  async function loadAppointments() {
    try {
      setLoading(true);
      setError('');

      const data = await api('/appointments/mine');

      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load appointments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  async function handleCancelAppointment(appointmentId) {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this appointment?'
    );

    if (!confirmed) return;

    try {
      setCancellingId(appointmentId);
      setError('');
      setMessage('');

      const result = await api(
        `/appointments/${appointmentId}/cancel`,
        { method: 'PATCH' }
      );

      setAppointments((previous) =>
        previous.map((item) =>
          item.appointment_id === appointmentId
            ? { ...item, status: 'Cancelled' }
            : item
        )
      );

      setMessage(
        result.message || 'Appointment cancelled successfully.'
      );

    } catch (err) {
      setError(err.message || 'Unable to cancel appointment.');
    } finally {
      setCancellingId(null);
    }
  }

  const initials = (me?.name || 'Patient')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="patient-portal-page">

      <header className="patient-portal-header">
        <div className="patient-portal-avatar">
          {initials}
        </div>

        <div>
          <span className="patient-portal-label">
            PATIENT PORTAL
          </span>
          <h2>{me?.name || 'Patient'}</h2>
          <p>Patient Account</p>
        </div>
      </header>

      <section className="patient-portal-appointments">

        <div className="patient-portal-section-heading">
          <div>
            <span className="patient-portal-label">
              APPOINTMENT MANAGEMENT
            </span>
            <h2>My Appointments</h2>
            <p>
              View your consultation schedules and appointment status.
            </p>
          </div>

          <span className="patient-portal-count">
            {appointments.length} Records
          </span>
        </div>

        {loading && <p>Loading appointments...</p>}

        {error && (
          <p className="patient-portal-error">{error}</p>
        )}

        {message && (
          <p style={{ color: 'green', marginTop: '12px' }}>
            {message}
          </p>
        )}

        {!loading && !error && appointments.length === 0 && (
          <div className="patient-portal-empty">
            <h3>No Appointments Yet</h3>
            <p>
              Your appointment records will appear here once booked.
            </p>
          </div>
        )}

        {!loading && !error && appointments.length > 0 && (
          <div className="patient-portal-list">

            {appointments.map((item) => {
              const dateValue =
                item.appointment_datetime || item.appointment_date;

              const date = dateValue
                ? new Date(String(dateValue).replace(' ', 'T'))
                : null;

              const validDate =
                date && !Number.isNaN(date.getTime());

              const statusClass = String(item.status || 'pending')
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '');

              const canCancel = ['pending', 'confirmed'].includes(
                String(item.status || '').toLowerCase()
              );

              return (
                <article
                  className="patient-portal-card"
                  key={item.appointment_id}
                >

                  <div className="patient-portal-doctor">
                    <span className="patient-portal-label">
                      CONSULTING DOCTOR
                    </span>

                    <h3>{item.doctor_name || 'Doctor'}</h3>

                    <p>
                      {item.specialization || 'Medical Consultation'}
                    </p>
                  </div>

                  <div className="patient-portal-schedule">

                    <span className="patient-portal-label">
                      APPOINTMENT DATE
                    </span>

                    <strong>
                      {validDate
                        ? date.toLocaleDateString('en-PH', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : 'Date not available'}
                    </strong>

                    <span className="patient-portal-label">
                      APPOINTMENT TIME
                    </span>

                    <strong>
                      {validDate
                        ? date.toLocaleTimeString('en-PH', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })
                        : '—'}
                    </strong>

                  </div>

                  <div className="patient-portal-details">

                    <span className="patient-portal-label">
                      STATUS
                    </span>

                    <span
                      className={`patient-portal-status ${statusClass}`}
                    >
                      {item.status || 'Pending'}
                    </span>

                    <span className="patient-portal-label">
                      REASON FOR CONSULTATION
                    </span>

                    <p>{item.reason || 'Not specified'}</p>

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCancelAppointment(item.appointment_id)
                        }
                        disabled={
                          cancellingId === item.appointment_id
                        }
                        style={{
                          marginTop: '16px',
                          padding: '10px 18px',
                          background: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          cursor:
                            cancellingId === item.appointment_id
                              ? 'not-allowed'
                              : 'pointer',
                          opacity:
                            cancellingId === item.appointment_id
                              ? 0.6
                              : 1
                        }}
                      >
                        {cancellingId === item.appointment_id
                          ? 'Cancelling...'
                          : 'Cancel Appointment'}
                      </button>
                    )}

                  </div>
                </article>
              );
            })}

          </div>
        )}

      </section>
    </div>
  );
}

function PatientMedicineInformation() {
  const [search, setSearch] = useState('');

  const medicines = [
    {
      name: 'Paracetamol',
      category: 'Pain and Fever Relief',
      description: 'A medicine commonly used to relieve mild to moderate pain and reduce fever.',
      reminder: 'Follow the product label or advice of a healthcare professional. Avoid taking multiple products containing paracetamol.'
    },
    {
      name: 'Cetirizine',
      category: 'Antihistamine',
      description: 'An antihistamine commonly used to relieve allergy symptoms.',
      reminder: 'May cause drowsiness in some people. Ask a pharmacist about possible side effects.'
    },
    {
      name: 'Ibuprofen',
      category: 'Pain and Inflammation Relief',
      description: 'A medicine used to relieve pain, fever, and inflammation.',
      reminder: 'It may not be suitable for people with certain stomach, kidney, or other health conditions. Ask a healthcare professional first.'
    },
    {
      name: 'Amoxicillin',
      category: 'Antibiotic',
      description: 'A prescription antibiotic used to treat certain bacterial infections.',
      reminder: 'Use only when prescribed. It does not treat viral infections such as colds or flu.'
    },
    {
      name: 'Oral Rehydration Salts (ORS)',
      category: 'Fluid Replacement',
      description: 'A mixture of salts and glucose used to help replace fluids and electrolytes lost through diarrhea or dehydration.',
      reminder: 'Prepare according to the packet instructions. Seek medical help for severe dehydration.'
    }
  ];

  const filteredMedicines = medicines.filter((medicine) =>
    medicine.name.toLowerCase().includes(search.toLowerCase()) ||
    medicine.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="patient-portal-page">
      <section className="patient-portal-appointments">
        <span className="patient-portal-label">
          HEALTHCARE REFERENCE
        </span>
        <h2>Medicine Information</h2>
        <p>
          Browse general information about commonly known medicines
          and their uses.
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search medicine..."
          style={{
            width: '100%',
            maxWidth: '450px',
            padding: '12px',
            marginTop: '20px',
            border: '1px solid #B8C9DC',
            borderRadius: '8px'
          }}
        />

        <div className="patient-portal-list" style={{ marginTop: '24px' }}>
          {filteredMedicines.map((medicine) => (
            <article
              className="patient-portal-card"
              key={medicine.name}
              style={{ gridTemplateColumns: '1fr' }}
            >
              <div className="patient-portal-doctor">
                <span className="patient-portal-label">
                  {medicine.category}
                </span>
                <h3>{medicine.name}</h3>
                <p>{medicine.description}</p>
              </div>

              <div className="patient-portal-details"
                style={{ borderLeft: 'none', paddingLeft: 0 }}>
                <strong>Safety Reminder</strong>
                <p>{medicine.reminder}</p>
              </div>
            </article>
          ))}

          {filteredMedicines.length === 0 && (
            <div className="patient-portal-empty">
              <h3>No Medicine Found</h3>
              <p>Try searching another medicine name.</p>
            </div>
          )}
        </div>

        <p style={{ marginTop: '24px', color: '#718096', fontSize: '13px' }}>
          Disclaimer: This catalog is for general educational
          information only. It is not a prescription or a substitute
          for professional medical advice. Consult a doctor or
          pharmacist before using any medicine.
        </p>
      </section>
    </div>
  );
}




function PatientProfile({ me, onProfileUpdated }) {
  const [patient, setPatient] = useState(null);
  const [image, setImage] = useState('');
  const [preview, setPreview] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    birth_date: '',
    sex: '',
    contact_number: '',
    address: '',
  });

  useEffect(() => {
    loadPatientProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function loadPatientProfile() {
    try {
      setLoading(true);

      const response = await fetch(`${API}/patient/profile`, {
        headers: {
          Authorization: 'Bearer ' + token(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load profile.');
      }

      const p = data.patient;

      setPatient(p);
      setImage(p.profile_image_url || '');

      setForm({
        full_name: p.full_name || '',
        birth_date: p.birth_date
          ? String(p.birth_date).slice(0, 10)
          : '',
        sex: p.sex || '',
        contact_number: p.contact_number || '',
        address: p.address || '',
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm(previous => ({
      ...previous,
      [name]: value,
    }));
  }

  function cancelEditing() {
    setForm({
      full_name: patient.full_name || '',
      birth_date: patient.birth_date
        ? String(patient.birth_date).slice(0, 10)
        : '',
      sex: patient.sex || '',
      contact_number: patient.contact_number || '',
      address: patient.address || '',
    });

    setEditing(false);
    setMessage('');
  }

  async function saveProfile() {
    try {
      setSaving(true);
      setMessage('');

      const response = await fetch(`${API}/patient/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token(),
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update profile.');
      }

      setPatient(data.patient);

      setForm({
        full_name: data.patient.full_name || '',
        birth_date: data.patient.birth_date
          ? String(data.patient.birth_date).slice(0, 10)
          : '',
        sex: data.patient.sex || '',
        contact_number: data.patient.contact_number || '',
        address: data.patient.address || '',
      });

      // Update the sidebar name immediately
      onProfileUpdated?.(data.patient.full_name);

      setEditing(false);
      setMessage('Profile updated successfully!');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Please select a JPG, PNG, or WebP image.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage('Image must not exceed 2 MB.');
      return;
    }

    if (preview) URL.revokeObjectURL(preview);

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setMessage('');
  }

  async function handleUpload() {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setMessage('');

      const result = await uploadProfilePicture(selectedFile);

      setImage(result.profile_image_url);
      setPatient(previous => ({
        ...previous,
        profile_image_url: result.profile_image_url,
      }));

      setPreview('');
      setSelectedFile(null);
      setMessage('Profile picture updated successfully!');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <section className="patient-profile-loading">Loading profile...</section>;
  }

  if (!patient) {
    return (
      <section className="patient-profile-loading">
        <h2>My Profile</h2>
        <p>{message || 'Unable to load patient information.'}</p>
        <button type="button" onClick={loadPatientProfile}>
          Try Again
        </button>
      </section>
    );
  }

  const initials = (patient.full_name || 'Patient')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

  return (
    <section className="patient-profile-card">

      <div className="patient-profile-heading">
        <div>
          <span className="patient-profile-eyebrow">ACCOUNT SETTINGS</span>
          <h2>My Patient Profile</h2>
          <p>View and manage your personal information.</p>
        </div>

        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setMessage('');
            }}
          >
            Edit Profile
          </button>
        ) : (
          <div className="patient-profile-actions">
            <button type="button" className="profile-cancel"
              onClick={cancelEditing}>
              Cancel
            </button>

            <button type="button" onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="patient-profile-layout">

        <div className="patient-profile-sidebar">

          <div className="patient-profile-avatar">
            {preview || image ? (
              <img
                src={preview || image}
                alt="Patient profile"
              />
            ) : (
              <div className="patient-profile-placeholder">
                {initials}
              </div>
            )}
          </div>

          <h3 className="patient-profile-display-name">
            {patient.full_name}
          </h3>

          <span className="patient-profile-role">Patient</span>

          <div className="patient-profile-upload">
            <label htmlFor="patient-profile-file">
              Change Profile Photo
            </label>

            <input
              id="patient-profile-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
            />

            <small>JPG, PNG, or WebP · Maximum 2 MB</small>

            {selectedFile && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </button>
            )}
          </div>

          <p className="patient-profile-code">
            Patient Code
            <strong>{patient.patient_code || 'Not available'}</strong>
          </p>
        </div>

        <div className="patient-profile-details">

          <div className="patient-profile-section-title">
            <h3>Personal Information</h3>
            <p>Your basic patient details.</p>
          </div>

          <div className="patient-profile-fields">

            <div className="patient-profile-field">
              <label>Full Name</label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                disabled={!editing}
              />
            </div>

            <div className="patient-profile-field">
              <label>Birth Date</label>
              <input
                type="date"
                name="birth_date"
                value={form.birth_date}
                onChange={handleChange}
                disabled={!editing}
              />
            </div>

            <div className="patient-profile-field">
              <label>Sex</label>
              <select
                name="sex"
                value={form.sex}
                onChange={handleChange}
                disabled={!editing}
              >
                <option value="">Select sex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

          </div>

          <div className="patient-profile-section-title contact-title">
            <h3>Contact Information</h3>
            <p>How the healthcare team can reach you.</p>
          </div>

          <div className="patient-profile-fields">

            <div className="patient-profile-field">
              <label>Contact Number</label>
              <input
                name="contact_number"
                value={form.contact_number}
                onChange={handleChange}
                disabled={!editing}
                placeholder="Enter contact number"
              />
            </div>

            <div className="patient-profile-field full-width">
              <label>Complete Address</label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                disabled={!editing}
                placeholder="Enter complete address"
                rows={4}
              />
            </div>

          </div>
        </div>
      </div>

      {message && (
        <p className="patient-profile-message" role="status">
          {message}
        </p>
      )}

    </section>
  );
}

// =====================================================
// MAIN APP
// =====================================================

function App() {
  const [me, setMe] = useState(user());
  const [page, setPage] = useState('Dashboard');

  const [language, setLanguage] = useState(
    localStorage.getItem('shms_language') || 'English'
  );

  const [theme, setTheme] = useState(
    localStorage.getItem('shms_theme') || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('shms_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('shms_language', language);
  }, [language]);

  if (!me || !token()) {
    return <Login done={setMe} />;
  }

  function logout() {
   sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setMe(null);
  }

  const menuItems =
    me.role === 'Patient'
      ? [
          'Dashboard',
          'Book Appointment',
          'My Appointments',
          'Medicine Information',
          'My Profile',
        ]
      : [
          'Dashboard',
          'Patients',
          'Appointments',
          'Billing',
          
          ...(me.role === 'Admin'
  ? ['Staff Accounts', 'Doctor Approvals']
  : []),
        ];

  const labels = {
    Dashboard: language === 'English' ? 'Dashboard' : 'Dashboard',
    'Book Appointment': language === 'English' ? 'Book Appointment' : 'Mag-book ng Appointment',
    'My Appointments': language === 'English' ? 'My Appointments' : 'Aking mga Appointment',
    'Medicine Information': language === 'English' ? 'Medicine Information' : 'Impormasyon sa Gamot',
    'My Profile': language === 'English' ? 'My Profile' : 'Aking Profile',
    Patients: language === 'English' ? 'Patients' : 'Mga Pasyente',
    Appointments: language === 'English' ? 'Appointments' : 'Mga Appointment',
    Billing: language === 'English' ? 'Billing' : 'Bayarin',
    'Staff Accounts': language === 'English' ? 'Staff Accounts' : 'Mga Account ng Staff',
    'Doctor Approvals': language === 'English'
  ? 'Doctor Approvals'
  : 'Approval ng mga Doctor',
  };

  return (
    <div className="app">
      <aside>
        <b>SHMS</b>

        <span>
          {me.name}
          <br />
          {me.role}
        </span>

        {menuItems.map((item) => (
          <button key={item} onClick={() => setPage(item)}>
            {labels[item] || item}
          </button>
        ))}

        <button onClick={logout}>
          {language === 'English' ? 'Logout' : 'Mag-logout'}
        </button>
      </aside>

      <main>
        <div className="global-controls">
  <div className="global-controls-user">
    <span>{me.name}</span>
    <small>{me.role}</small>
  </div>

  {/* LANGUAGE */}
  <button
    className="control-button language-button"
    onClick={() =>
      setLanguage(language === 'English' ? 'Tagalog' : 'English')
    }
  >
    {language === 'English' ? 'EN | TL' : 'TL | EN'}
  </button>

  {/* THEME */}
  <button
    className="control-button theme-button"
    onClick={() =>
      setTheme(theme === 'light' ? 'dark' : 'light')
    }
  >
    <span className="theme-icon">
      {theme === 'light' ? '◐' : '◑'}
    </span>
    {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
  </button>

</div>

        {me.role === 'Patient' ? (
          <>
            {page === 'Dashboard' && (
              <PatientDashboard me={me} onNavigate={setPage} />
            )}

            {page === 'Book Appointment' && <PatientBookAppointment />}
            {page === 'My Appointments' && <PatientAppointments me={me} />}
            {page === 'Medicine Information' && <PatientMedicineInformation />}

            {page === 'My Profile' && (
              <PatientProfile
                me={me}
                onProfileUpdated={(newName) => {
                  const updatedUser = {
                    ...me,
                    name: newName,
                  };

                  setMe(updatedUser);
                  
                  
                }}
              />
            )}
          </>
        ) : (
          <>
            {page === 'Dashboard' && <Dash />}
            {page === 'Patients' && <Patients />}
            {page === 'Appointments' && <Appointments />}
            {page === 'Billing' && <Billing />}
            {page === 'Staff Accounts' && me.role === 'Admin' && (
              <StaffAccounts />
            )}
            {page === 'Doctor Approvals' && me.role === 'Admin' && (
             <DoctorApprovals />
              )}
          </>
        )}
      </main>
    </div>
  );
}

// =====================================================
// STAFF ACCOUNTS
// =====================================================

function StaffAccounts() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const result = await api('/admin/staff', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setMessage(result.message || 'Staff account created successfully.');

      setForm({
        full_name: '',
        email: '',
        password: '',
      });
    } catch (err) {
      setError(err.message || 'Failed to create Staff account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Staff Accounts</h2>
      <p>Create a new Staff account.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Full Name
          <input
            type="text"
            value={form.full_name}
            onChange={(e) =>
              setForm({ ...form, full_name: e.target.value })
            }
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
            minLength={8}
            maxLength={128}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Staff Account'}
        </button>
      </form>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </section>
  );
}


// =====================================================
// DASHBOARD
// =====================================================
// =====================================================
// DOCTOR APPROVALS
// =====================================================

function DoctorApprovals() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadDoctors() {
    setLoading(true);
    setError('');

    try {
      const result = await api('/admin/doctor-registrations');
      setDoctors(Array.isArray(result) ? result : result.doctors || []);
    } catch (err) {
      setError(err.message || 'Failed to load doctor registrations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoctors();
  }, []);

  async function updateDoctor(userId, action) {
    setError('');
    setMessage('');

    try {
      const result = await api(
        `/admin/doctor-registrations/${userId}/${action}`,
        { method: 'PATCH' }
      );

      setMessage(result.message || `Doctor ${action}d successfully.`);
      await loadDoctors();
    } catch (err) {
      setError(err.message || `Failed to ${action} doctor.`);
    }
  }

  return (
    <section>
      <h2>Doctor Approvals</h2>
      <p>Review and manage pending doctor registrations.</p>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading ? (
        <p>Loading doctor registrations...</p>
      ) : doctors.length === 0 ? (
        <p>No pending doctor registrations.</p>
      ) : (
        doctors.map((doctor) => (
          <div
            key={doctor.user_id}
            style={{
              border: '1px solid #ddd',
              padding: '16px',
              marginBottom: '12px',
              borderRadius: '8px',
            }}
          >
            <h3>{doctor.full_name}</h3>
            <p>Email: {doctor.email}</p>
            <p>License Number: {doctor.license_number}</p>
            <p>Specialization: {doctor.specialization}</p>
            <p>Status: {doctor.approval_status}</p>

            <button onClick={() => updateDoctor(doctor.user_id, 'approve')}>
              Approve
            </button>

            <button onClick={() => updateDoctor(doctor.user_id, 'reject')}>
              Reject
            </button>
          </div>
        ))
      )}
    </section>
  );
}




// =====================================================
// DASHBOARD
// =====================================================

function Dash() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/dashboard/summary').then(setData);
  }, []);

  const modules = [
    {
      number: '01',
      title: 'Patient Records',
      description: 'Manage and review registered patient information.',
    },
    {
      number: '02',
      title: 'Doctor Management',
      description: 'View doctor information and specializations.',
    },
    {
      number: '03',
      title: 'Appointments',
      description: 'Manage patient appointment requests and schedules.',
    },
    {
      number: '04',
      title: 'Medical Records',
      description: 'Access and organize patient medical information.',
    },
    {
      number: '05',
      title: 'Prescriptions',
      description: 'Manage prescription-related information.',
    },
    {
      number: '06',
      title: 'Billing and Payments',
      description: 'Review billing records and payment information.',
    },
    {
      number: '07',
      title: 'AI Database Assistant',
      description: 'Access the healthcare database assistant.',
    },
  ];

  return (
    <div className="professional-dashboard">

      <div className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">
            SMART HEALTHCARE MANAGEMENT SYSTEM
          </span>
          <h2>Dashboard Overview</h2>
          <p>Monitor your healthcare system activities and records.</p>
        </div>
      </div>

      <div className="dashboard-section-title">
        <h3>System Summary</h3>
        <p>Current system statistics</p>
      </div>

      {data ? (
        <div className="dashboard-stat-grid">

          <div className="dashboard-stat-card">
            <div className="stat-card-top">
              <span>Patient Records</span>
              <span className="stat-icon">PT</span>
            </div>
            <strong>{data.patients}</strong>
            <small>Registered patients</small>
          </div>

          <div className="dashboard-stat-card">
            <div className="stat-card-top">
              <span>Doctors</span>
              <span className="stat-icon">DR</span>
            </div>
            <strong>{data.doctors}</strong>
            <small>Registered doctors</small>
          </div>

          <div className="dashboard-stat-card">
            <div className="stat-card-top">
              <span>Appointments</span>
              <span className="stat-icon">AP</span>
            </div>
            <strong>{data.appointments}</strong>
            <small>Total appointments</small>
          </div>

          <div className="dashboard-stat-card">
            <div className="stat-card-top">
              <span>Unpaid Balance</span>
              <span className="stat-icon">₱</span>
            </div>
            <strong>
              ₱{Number(data.unpaidAmount).toFixed(2)}
            </strong>
            <small>Outstanding amount</small>
          </div>

        </div>
      ) : (
        <section className="dashboard-loading">
          Loading dashboard information...
        </section>
      )}

      <div className="dashboard-section-title">
        <h3>System Modules</h3>
        <p>Healthcare management services and functionalities</p>
      </div>

      <div className="dashboard-module-grid">
        {modules.map((module) => (
          <div className="dashboard-module-card" key={module.number}>
            <span className="module-number">{module.number}</span>
            <h4>{module.title}</h4>
            <p>{module.description}</p>
          </div>
        ))}
      </div>

      <div className="dashboard-footer">
        <span>SHMS</span>
        <p>Smart Healthcare Management System</p>
      </div>

    </div>
  );
}


// =====================================================
// PATIENTS
// =====================================================

function Patients() {
  const [rows, setRows] = useState([]);

  const [form, setForm] = useState({
    patient_code: '',
    full_name: '',
    birth_date: '',
    sex: '',
    contact_number: '',
    address: '',
  });

  const [message, setMessage] = useState('');

  const load = () => {
    api('/patients')
      .then(setRows)
      .catch((error) => setMessage(error.message));
  };

  useEffect(load, []);

  async function addPatient(event) {
    event.preventDefault();

    try {
      await api('/patients', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setForm({
        patient_code: '',
        full_name: '',
        birth_date: '',
        sex: '',
        contact_number: '',
        address: '',
      });

      setMessage('Added');

      load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deletePatient(id) {
    if (confirm('Delete patient?')) {
      try {
        await api('/patients/' + id, {
          method: 'DELETE',
        });

        load();
      } catch (error) {
        setMessage(error.message);
      }
    }
  }

  return (
    <>
      <h2>Patients</h2>

      <form className="form" onSubmit={addPatient}>
        {Object.keys(form).map((key) => (
          <input
            key={key}
            type={
              key === 'birth_date'
                ? 'date'
                : 'text'
            }
            placeholder={key}
            value={form[key]}
            onChange={(e) =>
              setForm({
                ...form,
                [key]: e.target.value,
              })
            }
            required={
              key === 'patient_code' ||
              key === 'full_name'
            }
          />
        ))}

        <button>Add Patient</button>
      </form>

      <p>{message}</p>

      <Table
        rows={rows}
        del={deletePatient}
      />
    </>
  );
}

// =====================================================
// TABLE
// =====================================================

function Table({ rows, del }) {
  return (
    <section>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Code</th>
            <th>Name</th>
            <th>Birth</th>

            {del && <th>Action</th>}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.patient_id}>
              <td>{row.patient_id}</td>

              <td>{row.patient_code}</td>

              <td>{row.full_name}</td>

              <td>
                {String(row.birth_date || '').slice(
                  0,
                  10
                )}
              </td>

              {del && (
                <td>
                  <button
                    onClick={() =>
                      del(row.patient_id)
                    }
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// =====================================================
// GENERIC LIST
// =====================================================

function List({ path, title }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api(path)
      .then(setRows)
      .catch(() => {});
  }, [path]);

  return (
    <>
      <h2>{title}</h2>

      <section>
        <table>
          <thead>
            <tr>
              {rows[0] &&
                Object.keys(rows[0])
                  .slice(0, 6)
                  .map((key) => (
                    <th key={key}>{key}</th>
                  ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {Object.keys(row)
                  .slice(0, 6)
                  .map((key) => (
                    <td key={key}>
                      {String(row[key] ?? '')}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

// =====================================================
// AI DATABASE ASSISTANT
// =====================================================

function AI() {
  const [intent, setIntent] = useState(
    'patient_appointment_count'
  );

  const [patientCode, setPatientCode] =
    useState('P-001');

  const [status, setStatus] =
    useState('Confirmed');

  const [result, setResult] = useState(null);

  async function run() {
    const body = {
      intent,
    };

    if (intent === 'patient_appointment_count') {
      body.patientCode = patientCode;
    }

    if (intent === 'appointments_by_status') {
      body.status = status;
    }

    setResult(
      await api('/ai/query', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    );
  }

  return (
    <>
      <h2>AI Database Assistant</h2>

      <section>
        <p>
          This safe demo maps approved questions to
          fixed read-only parameterized SQL. It does
          not execute arbitrary generated SQL.
        </p>

        <select
          value={intent}
          onChange={(e) =>
            setIntent(e.target.value)
          }
        >
          <option value="patient_appointment_count">
            Patient appointment count
          </option>

          <option value="appointments_by_status">
            Appointments by status
          </option>

          <option value="unpaid_invoices">
            Unpaid invoices
          </option>
        </select>

        {intent === 'patient_appointment_count' && (
          <input
            value={patientCode}
            onChange={(e) =>
              setPatientCode(e.target.value)
            }
            placeholder="Patient code"
          />
        )}

        {intent === 'appointments_by_status' && (
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value)
            }
          >
            <option>Pending</option>
            <option>Confirmed</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
        )}

        <button onClick={run}>Run</button>

        {result && (
          <pre>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>
    </>
  );
}

// =====================================================
// RENDER APP
// =====================================================

createRoot(
  document.getElementById('root')
).render(<App />);