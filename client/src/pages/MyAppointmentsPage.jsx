import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { cancelAppointment, getMyAppointments, rescheduleAppointment } from '../api/appointmentApi';

const toLocalInput = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rescheduleId, setRescheduleId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const location = useLocation();
  const minimumDateTime = useMemo(() => toLocalInput(new Date()), []);

  const loadAppointments = useCallback(async () => {
    setError('');
    try {
      setAppointments(await getMyAppointments());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load your appointments. Please sign in again if your session expired.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setNotice(location.state?.notice || '');
    loadAppointments();
  }, [loadAppointments, location.state]);

  const cancel = async (appointmentId) => {
    setSaving(true);
    setError('');
    try {
      await cancelAppointment(appointmentId);
      setNotice('Appointment cancelled. Its time is available to book again.');
      await loadAppointments();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel the appointment.');
    } finally {
      setSaving(false);
    }
  };

  const saveReschedule = async (event) => {
    event.preventDefault();
    if (!newDate) return setError('Choose a new date and time.');
    setSaving(true);
    setError('');
    try {
      // Keep the selected wall-clock time; the server and clinic use the same
      // configured local timezone for appointment slots.
      await rescheduleAppointment(rescheduleId, `${newDate}:00`);
      setNotice('Appointment rescheduled successfully.');
      setRescheduleId('');
      setNewDate('');
      await loadAppointments();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reschedule the appointment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 p-6 w-full">
        <h1 className="text-2xl font-bold text-blue-800 mb-6">My Appointments</h1>
        {notice && <p role="status" className="mb-4 text-green-700">{notice}</p>}
        {error && <p role="alert" className="mb-4 text-red-600">{error}</p>}
        {loading ? <p>Loading appointments...</p> : appointments.length === 0 ? (
          <p className="text-gray-600">You haven't booked any appointments yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {appointments.map((appt) => {
              const futureUpcoming = appt.status === 'upcoming' && new Date(appt.date) > new Date();
              return (
                <div key={appt._id} className="bg-white shadow-md rounded-xl p-4 border border-gray-100">
                  <h2 className="text-lg font-semibold text-blue-700 mb-2">{appt.doctorId?.name || 'Doctor unavailable'}</h2>
                  <p className="text-sm text-gray-600"><strong>Specialty:</strong> {appt.doctorId?.specialty || '—'}</p>
                  <p className="text-sm text-gray-600"><strong>Hospital:</strong> {appt.doctorId?.hospital || '—'}</p>
                  <p className="text-sm text-gray-600 mt-2"><strong>Date:</strong> {new Date(appt.date).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-600"><strong>Time:</strong> {new Date(appt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className={`text-sm mt-1 font-medium ${appt.status === 'upcoming' ? 'text-green-700' : 'text-gray-600'}`}>Status: {appt.status}</p>
                  {futureUpcoming && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" disabled={saving} onClick={() => { setRescheduleId(appt._id); setNewDate(''); }} className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">Reschedule</button>
                      <button type="button" disabled={saving} onClick={() => cancel(appt._id)} className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50">Cancel</button>
                    </div>
                  )}
                  {rescheduleId === appt._id && (
                    <form onSubmit={saveReschedule} className="mt-4 border-t pt-3">
                      <label htmlFor={`reschedule-${appt._id}`} className="mb-1 block text-sm font-medium">New date and time</label>
                      <input id={`reschedule-${appt._id}`} type="datetime-local" min={minimumDateTime} value={newDate} onChange={(event) => setNewDate(event.target.value)} required className="w-full rounded border px-3 py-2" />
                      <div className="mt-2 flex gap-2">
                        <button type="submit" disabled={saving} className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save change'}</button>
                        <button type="button" disabled={saving} onClick={() => setRescheduleId('')} className="rounded border px-3 py-2 text-sm">Keep current</button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
