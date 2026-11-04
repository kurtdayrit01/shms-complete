
import React, { useState } from 'react';
import './PatientAI.css';

const API = 'http://localhost:4000/api';

export default function PatientAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I am your SHMS Patient Assistant. I can help you understand appointments and how to use the patient portal. How can I help you today?'
    }
  ]);

  async function sendMessage(event) {
    event?.preventDefault();

    const text = message.trim();

    if (!text || loading) return;

    const token = sessionStorage.getItem('token');

    if (!token) {
      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          content: 'Your session has expired. Please log in again.'
        }
      ]);
      return;
    }

    const updatedMessages = [
      ...messages,
      { role: 'user', content: text }
    ];

    setMessages(updatedMessages);
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          history: updatedMessages
            .slice(-7, -1)
            .map(item => ({
              role: item.role,
              content: item.content
            }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to contact AI assistant.');
      }

      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          content: data.reply || 'No response received.'
        }
      ]);

    } catch (error) {
      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          content: error.message || 'AI assistant is unavailable.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="patient-ai-widget">

      {isOpen && (
        <section className="patient-ai-window">

          <header className="patient-ai-header">
            <div>
              <strong>SHMS Patient Assistant</strong>
              <small>Local AI Assistant</small>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          <div className="patient-ai-messages">

            {messages.map((item, index) => (
              <div
                key={index}
                className={`patient-ai-message ${item.role}`}
              >
                {item.content}
              </div>
            ))}

            {loading && (
              <div className="patient-ai-message assistant">
                Thinking...
              </div>
            )}

          </div>

          <form
            className="patient-ai-input-area"
            onSubmit={sendMessage}
          >
            <input
              type="text"
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder="Ask something..."
              maxLength={2000}
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading || !message.trim()}
            >
              Send
            </button>
          </form>

          <p className="patient-ai-disclaimer">
            General information only. For medical concerns, consult a qualified doctor.
          </p>

        </section>
      )}

      <button
  type="button"
  className="patient-ai-toggle"
  onClick={() => setIsOpen(previous => !previous)}
  aria-label="Open patient assistant"
>
  {isOpen ? (
    <span className="patient-ai-close">×</span>
  ) : (
    <img
      src="/ai-assistant.png"
      alt="AI Healthcare Assistant"
      className="patient-ai-logo"
    />
  )}
</button>

    </div>
  );
}
