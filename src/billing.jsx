import React, { useCallback, useEffect, useState } from 'react';
import './billing.css';

const API = 'http://localhost:4000/api/billing';

const money = value =>
  '₱' + Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const dateTime = value => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const newItem = () => ({
  item_description: '',
  quantity: 1,
  unit_price: ''
});

export default function Billing() {
  const currentUser = JSON.parse(
    sessionStorage.getItem('user') || 'null'
  );

  const isStaff = currentUser?.role === 'Staff';

  const [invoices, setInvoices] = useState([]);
  const [eligible, setEligible] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState('');
  const [items, setItems] = useState([newItem()]);
  const [payment, setPayment] = useState({
    invoice_id: '',
    amount: '',
    payment_method: 'Cash',
    reference_number: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const request = useCallback(async (url, options = {}) => {
    const token = sessionStorage.getItem('token');

    if (!token) {
      throw new Error('Please log in again.');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Request failed.');
    }

    return data;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const invoiceData = await request(API);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);

      if (isStaff) {
        const appointmentData = await request(
          `${API}/eligible-appointments`
        );

        setEligible(
          Array.isArray(appointmentData) ? appointmentData : []
        );
      }
    } catch (err) {
      setError(err.message || 'Unable to load billing data.');
    } finally {
      setLoading(false);
    }
  }, [request, isStaff]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateItem = (index, field, value) => {
    setItems(previous =>
      previous.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addItem = () => {
    setItems(previous => [...previous, newItem()]);
  };

  const removeItem = index => {
    setItems(previous =>
      previous.length === 1
        ? previous
        : previous.filter((_, i) => i !== index)
    );
  };

  const invoiceTotal = items.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity || 0) *
      Number(item.unit_price || 0),
    0
  );

  const createInvoice = async event => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!selectedAppointment) {
      setError('Please select a completed appointment.');
      return;
    }

    if (
      items.some(item =>
        !item.item_description.trim() ||
        Number(item.quantity) < 1 ||
        Number(item.unit_price) <= 0
      )
    ) {
      setError('Please complete all invoice item details.');
      return;
    }

    setSaving(true);

    try {
      await request(API, {
        method: 'POST',
        body: JSON.stringify({
          appointment_id: Number(selectedAppointment),
          items: items.map(item => ({
            item_description: item.item_description.trim(),
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price)
          }))
        })
      });

      setMessage('Invoice created successfully!');
      setSelectedAppointment('');
      setItems([newItem()]);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const recordPayment = async event => {
    event.preventDefault();
    setError('');
    setMessage('');

    const invoiceId = Number(payment.invoice_id);
    const amount = Number(payment.amount);

    if (!invoiceId || amount <= 0) {
      setError('Select an invoice and enter a valid payment amount.');
      return;
    }

    setSaving(true);

    try {
      await request(`${API}/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          payment_method: payment.payment_method,
          reference_number: payment.reference_number.trim()
        })
      });

      setMessage('Payment recorded successfully!');
      setPayment({
        invoice_id: '',
        amount: '',
        payment_method: 'Cash',
        reference_number: ''
      });

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const searchText = search.toLowerCase();

    return (
      String(invoice.invoice_id).includes(searchText) ||
      String(invoice.patient_name || '').toLowerCase().includes(searchText) ||
      String(invoice.patient_code || '').toLowerCase().includes(searchText) ||
      String(invoice.status || '').toLowerCase().includes(searchText)
    );
  });

  const selectedInvoice = invoices.find(
    invoice => Number(invoice.invoice_id) === Number(payment.invoice_id)
  );

  const unpaidInvoices = invoices.filter(
    invoice => Number(invoice.balance) > 0.001
  );

  const totalRevenue = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount_paid || 0),
    0
  );

  const totalOutstanding = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.balance || 0),
    0
  );

  return (
    <div className="shms-billing">
      <div className="shms-billing-header">
        <div>
          <span className="shms-billing-eyebrow">
            FINANCIAL MANAGEMENT
          </span>
          <h1>Billing & Payments</h1>
          <p>Manage patient invoices and payment records.</p>
        </div>

        <button
          className="shms-billing-refresh"
          onClick={loadData}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="shms-billing-alert error">
          {error}
        </div>
      )}

      {message && (
        <div className="shms-billing-alert success">
          {message}
        </div>
      )}

      <div className="shms-billing-stats">
        <div className="shms-billing-stat">
          <span>Total Invoices</span>
          <strong>{invoices.length}</strong>
        </div>

        <div className="shms-billing-stat">
          <span>Payments Received</span>
          <strong>{money(totalRevenue)}</strong>
        </div>

        <div className="shms-billing-stat">
          <span>Outstanding Balance</span>
          <strong>{money(totalOutstanding)}</strong>
        </div>
      </div>

      {isStaff && (
        <>
          <section className="shms-billing-section">
            <div className="shms-billing-section-heading">
              <div>
                <h2>Ready for Invoicing</h2>
                <p>
                  Completed appointments without an existing invoice.
                </p>
              </div>

              <span className="shms-billing-count">
                {eligible.length} appointments
              </span>
            </div>

            {loading ? (
              <p className="shms-billing-empty">Loading appointments...</p>
            ) : eligible.length === 0 ? (
              <p className="shms-billing-empty">
                No completed appointments waiting for invoices.
              </p>
            ) : (
              <div className="shms-billing-appointment-list">
                {eligible.map(appointment => (
                  <div
                    className="shms-billing-appointment"
                    key={appointment.appointment_id}
                  >
                    <div>
                      <strong>{appointment.patient_name}</strong>
                      <span>
                        {appointment.patient_code} · Appointment #
                        {appointment.appointment_id}
                      </span>
                      <span>
                        Doctor: {appointment.doctor_name || '—'}
                      </span>
                      <span>
                        {dateTime(appointment.appointment_datetime)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="shms-billing-primary"
                      onClick={() => {
                        setSelectedAppointment(
                          String(appointment.appointment_id)
                        );
                        setError('');
                        setMessage('');
                      }}
                    >
                      Create Invoice
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="shms-billing-section">
            <div className="shms-billing-section-heading">
              <div>
                <h2>Create Invoice</h2>
                <p>
                  Select an appointment and add its billing items.
                </p>
              </div>
            </div>

            <form onSubmit={createInvoice}>
              <div className="shms-billing-field">
                <label>Completed Appointment</label>

                <select
                  value={selectedAppointment}
                  onChange={event =>
                    setSelectedAppointment(event.target.value)
                  }
                  required
                >
                  <option value="">Select appointment</option>

                  {eligible.map(appointment => (
                    <option
                      key={appointment.appointment_id}
                      value={appointment.appointment_id}
                    >
                      #{appointment.appointment_id} — {appointment.patient_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="shms-billing-items-heading">
                <h3>Invoice Items</h3>

                <button
                  type="button"
                  className="shms-billing-secondary"
                  onClick={addItem}
                >
                  + Add Item
                </button>
              </div>

              {items.map((item, index) => (
                <div className="shms-billing-item" key={index}>
                  <div className="shms-billing-field description">
                    <label>Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Consultation Fee"
                      value={item.item_description}
                      onChange={event =>
                        updateItem(
                          index,
                          'item_description',
                          event.target.value
                        )
                      }
                      maxLength={255}
                      required
                    />
                  </div>

                  <div className="shms-billing-field">
                    <label>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={event =>
                        updateItem(index, 'quantity', event.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="shms-billing-field">
                    <label>Unit Price (₱)</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.unit_price}
                      onChange={event =>
                        updateItem(index, 'unit_price', event.target.value)
                      }
                      required
                    />
                  </div>

                  <button
                    type="button"
                    className="shms-billing-remove"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}

              <div className="shms-billing-total">
                <span>Invoice Total</span>
                <strong>{money(invoiceTotal)}</strong>
              </div>

              <button
                className="shms-billing-primary"
                type="submit"
                disabled={saving || !selectedAppointment}
              >
                {saving ? 'Creating...' : 'Create Invoice'}
              </button>
            </form>
          </section>

          <section className="shms-billing-section">
            <div className="shms-billing-section-heading">
              <div>
                <h2>Record Payment</h2>
                <p>Accept cash or bank transfer payments.</p>
              </div>
            </div>

            <form onSubmit={recordPayment}>
              <div className="shms-billing-payment-grid">
                <div className="shms-billing-field">
                  <label>Invoice</label>
                  <select
                    value={payment.invoice_id}
                    onChange={event =>
                      setPayment({
                        ...payment,
                        invoice_id: event.target.value
                      })
                    }
                    required
                  >
                    <option value="">Select unpaid invoice</option>

                    {unpaidInvoices.map(invoice => (
                      <option
                        key={invoice.invoice_id}
                        value={invoice.invoice_id}
                      >
                        #{invoice.invoice_id} — {invoice.patient_name}
                        {' '}({money(invoice.balance)} balance)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="shms-billing-field">
                  <label>Payment Amount (₱)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={selectedInvoice?.balance || undefined}
                    value={payment.amount}
                    onChange={event =>
                      setPayment({
                        ...payment,
                        amount: event.target.value
                      })
                    }
                    required
                  />
                </div>

                <div className="shms-billing-field">
                  <label>Payment Method</label>
                  <select
                    value={payment.payment_method}
                    onChange={event =>
                      setPayment({
                        ...payment,
                        payment_method: event.target.value
                      })
                    }
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div className="shms-billing-field">
                  <label>Reference Number (Optional)</label>
                  <input
                    type="text"
                    maxLength={120}
                    placeholder="Bank transaction reference"
                    value={payment.reference_number}
                    onChange={event =>
                      setPayment({
                        ...payment,
                        reference_number: event.target.value
                      })
                    }
                  />
                </div>
              </div>

              {selectedInvoice && (
                <p className="shms-billing-balance">
                  Remaining balance: <strong>
                    {money(selectedInvoice.balance)}
                  </strong>
                </p>
              )}

              <button
                type="submit"
                className="shms-billing-primary"
                disabled={saving || !payment.invoice_id}
              >
                {saving ? 'Recording...' : 'Record Payment'}
              </button>
            </form>
          </section>
        </>
      )}

      <section className="shms-billing-section">
        <div className="shms-billing-section-heading">
          <div>
            <h2>Invoice History</h2>
            <p>Review patient invoices and payment status.</p>
          </div>

          <input
            className="shms-billing-search"
            type="search"
            placeholder="Search invoice or patient..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <p className="shms-billing-empty">Loading invoices...</p>
        ) : filteredInvoices.length === 0 ? (
          <p className="shms-billing-empty">No invoices found.</p>
        ) : (
          <div className="shms-billing-table-wrap">
            <table className="shms-billing-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.map(invoice => (
                  <tr key={invoice.invoice_id}>
                    <td>INV-{invoice.invoice_id}</td>
                    <td>
                      <strong>{invoice.patient_name}</strong>
                      <small>{invoice.patient_code}</small>
                    </td>
                    <td>
                      {dateTime(invoice.appointment_datetime || invoice.invoice_date)}
                    </td>
                    <td>{money(invoice.total_amount)}</td>
                    <td>{money(invoice.amount_paid)}</td>
                    <td>{money(invoice.balance)}</td>
                    <td>
                      <span
                        className={
                          'shms-billing-status ' +
                          String(invoice.status || '').toLowerCase().replaceAll(' ', '-')
                        }
                      >
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}