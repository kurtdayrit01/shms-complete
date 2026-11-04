
import express from 'express';
import { auth } from './auth.js';

const router = express.Router();

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'qwen2.5:1.5b';


function getPreparedAnswer(message) {
  const text = message.toLowerCase().trim();

  // APPOINTMENT CANCELLATION
  if (
    /\b(cancel|cancellation|kansel|kanselahin)\b/.test(text) ||
    /mag.cancel/.test(text)
  ) {
    return `Para mag-cancel ng appointment:

1. Buksan ang My Appointments.
2. Hanapin ang appointment na gusto mong i-cancel.
3. Gamitin ang available Cancel option.

Hindi ako ang mismong nagca-cancel ng appointment.`;
  }

  // APPOINTMENT STATUS
  if (
    /\b(status|confirmed|confirmation|pending)\b/.test(text) ||
    /saan.*(appointment|booking).*(status|kalagayan)/.test(text) ||
    /status.*appointment/.test(text)
  ) {
    return `Para makita ang status ng appointment mo, buksan ang My Appointments. Doon mo makikita ang iyong appointment records at available status information.`;
  }

  // APPOINTMENT BOOKING
  if (
    /\b(book|booking|schedule|appointment)\b/.test(text) ||
    /mag.book/.test(text) ||
    /magpa.appointment/.test(text)
  ) {
    return `Para mag-book ng appointment:

1. Buksan ang Book Appointment page.
2. Piliin ang available Department at Doctor.
3. Piliin ang Date at Time.
4. I-check ang details at i-submit ang booking request.

Maaaring kailanganin pang kumpirmahin ang appointment request mo.`;
  }

  // PROFILE
  if (
    /\b(profile|personal information|account details)\b/.test(text) ||
    /i.update.*profile/.test(text) ||
    /baguhin.*profile/.test(text)
  ) {
    return `Para makita o i-update ang profile mo:

1. Buksan ang My Profile page.
2. Hanapin ang information na gusto mong baguhin.
3. Gamitin ang available update o save option sa page.`;
  }

  // MEDICINE INFORMATION
  if (
    /\b(medicine|medication|gamot|medicines)\b/.test(text) ||
    /medicine information/.test(text)
  ) {
    return `Para makita ang medicine-related information, buksan ang Medicine Information page.

Para sa personal medication concerns, kumonsulta muna sa qualified healthcare professional.`;
  }

  return null;
}


router.post('/chat', auth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        message: 'Please enter a message.'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        message: 'Message is too long.'
      });
    }
    const preparedAnswer = getPreparedAnswer(message);

if (preparedAnswer) {
  return res.json({
    reply: preparedAnswer
  });
}

    const safeHistory = Array.isArray(history)
      ? history
          .filter(item =>
            ['user', 'assistant'].includes(item.role) &&
            typeof item.content === 'string'
          )
          .slice(-6)
          .map(item => ({
            role: item.role,
            content: item.content.slice(0, 2000)
          }))
      : [];

    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `
You are the SHMS Patient Assistant.

MAIN PURPOSE:
Your main purpose is to guide patients in using the Smart Healthcare Management System.

APPOINTMENT GUIDE:
- Explain how patients can book an appointment through the patient portal.
- Guide patients to the Book Appointment page when they want to schedule.
- Patients should select an available Department, Doctor, Date, and Time before submitting their booking request.
- Patients can check their appointment records and status in My Appointments.
- Patients can use the available Cancel option in My Appointments if they want to cancel.
- Appointment requests may need confirmation.
- Never claim that you booked, changed, or cancelled an appointment.
- Do not invent appointment availability, doctors, or booking statuses.

PATIENT PORTAL PAGES:
These are the only actual patient portal pages:
1. Dashboard
2. Book Appointment
3. My Appointments
4. Medicine Information
5. My Profile

PAGE GUIDE:
- Dashboard: Main patient page where patients can view dashboard information.
- Book Appointment: Used to request a new appointment.
- My Appointments: Used to view appointment records and use the available Cancel option.
- Medicine Information: Used for medicine-related information. Recommend consulting a qualified healthcare professional before making medication decisions.
- My Profile: Used to view or update profile information.

NAVIGATION RULES:
- Always use the exact page names listed above.
- Give simple step-by-step instructions when needed.
- Do not invent pages or features.
- Do not claim that a Billing page exists in the patient portal.
- Never invent an Appointment Status page.
- If a feature is unavailable or unknown, explain that clearly.

GENERAL RULES:
- Use simple and friendly language.
- Support English and Filipino.
- Do not diagnose illnesses or prescribe medicine.
- For medical concerns, recommend consulting a qualified doctor.
- Never claim to have accessed patient records, billing details, or appointment information.
- Never invent email confirmations or appointment statuses.
- Only describe procedures supported by the actual SHMS system.

FILIPINO LANGUAGE QUALITY:
- When the patient speaks Filipino, respond in natural, conversational Taglish.
- Use simple and familiar Filipino words.
- Keep technical terms in English, such as Dashboard, Department, Doctor, Date, Time, Submit, and My Appointments.
- Never translate English word-for-word.
- Avoid awkward Filipino grammar.
- Do not use Cebuano or Bisaya unless requested.
- If you cannot produce correct Filipino, use clear and simple English.

RESPONSE STYLE:
- Keep answers short, clear, and organized.
- Answer only what the patient asks.
- Use numbered steps for instructions.
- Do not combine booking, cancellation, profile, and appointment-status instructions unless requested.
- Do not repeat the same instructions.
- Do not tell patients to click or tap buttons multiple times.
- Do not add unrelated information.

EXAMPLE 1:
Patient: Paano mag-book ng appointment?

Assistant:
Para mag-book ng appointment:

1. Buksan ang Book Appointment page.
2. Piliin ang available Department at Doctor.
3. Piliin ang Date at Time.
4. I-check ang details at i-submit ang booking request.

EXAMPLE 2:
Patient: Saan ko makikita ang status ng appointment ko?

Assistant:
Buksan ang My Appointments page. Doon mo makikita ang iyong appointment records at available status information.

EXAMPLE 3:
Patient: Paano mag-cancel ng appointment?

Assistant:
1. Buksan ang My Appointments.
2. Hanapin ang appointment na gusto mong i-cancel.
3. Gamitin ang available Cancel option.

IMPORTANT:
Never claim that you performed an action for the patient. You are an information assistant only.
`
          },
          ...safeHistory,
          {
            role: 'user',
            content: message.trim()
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = await response.json();

    res.json({
      reply: data.message?.content || 'No response received.'
    });

  } catch (error) {
    console.error('SHMS AI error:', error.message);

    res.status(503).json({
      message: 'AI assistant is unavailable. Please try again.'
    });
  }
});

export default router;
