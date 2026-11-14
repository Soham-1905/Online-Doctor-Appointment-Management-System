import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { fetchDoctors } from '../api/doctorApi';
import { bookAppointment, getAvailability } from '../api/appointmentApi';

const getLocalDate = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export default function BookAppointmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [doctorLoaded, setDoctorLoaded] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const minimumDate = useMemo(() => getLocalDate(), []);

  useEffect(() => {
    let active = true;
    setDoctor(null);
    setDoctorLoaded(false);
    setError('');
    fetchDoctors()
      .then((doctors) => {
        if (active) setDoctor(doctors.find((item) => item._id === id) || null);
      })
      .catch(() => active && setError('Could not load doctors. Please try again.'))
      .finally(() => active && setDoctorLoaded(true));
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    setTime('');
    setAvailableTimes([]);
    setError('');
    if (!date || !doctor) return undefined;
    setLoadingSlots(true);
    getAvailability(id, date)
      .then((times) => {
        if (active) {
          setAvailableTimes(times);
          setTime(times[0] || '');
        }
      })
      .catch(() => active && setError('Availability could not be checked. Please retry.'))
      .finally(() => active && setLoadingSlots(false));
    return () => { active = false; };
  }, [date, doctor, id]);

  const handleBooking = async (event) => {
    event.preventDefault();
    if (!date || !time) {
      setError('Choose a date and an available time.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await bookAppointment(id, `${date}T${time}:00`);
      navigate('/appointments', { state: { notice: 'Appointment booked successfully.' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed. Please try again.');
      if (err.response?.status === 409) {
        try {
          const times = await getAvailability(id, date);
          setAvailableTimes(times);
          setTime(times[0] || '');
        } catch { /* Keep the original booking conflict visible. */ }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 p-6 w-full">
        <h1 className="text-2xl font-bold text-blue-800 mb-6">Book Appointment</h1>
        {!doctorLoaded ? <p>Loading doctor info...</p> : !doctor ? (
          <p role="status" className="text-gray-600">Doctor not found. Return to the doctor list and choose a provider.</p>
        ) : (
          <form onSubmit={handleBooking} className="bg-white shadow-xl p-6 rounded-xl max-w-xl">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{doctor.name}</h2>
            <p className="text-gray-600 mb-1">Specialty: {doctor.specialty}</p>
            <p className="text-gray-600 mb-4">Hospital: {doctor.hospital}</p>
            <label htmlFor="appointment-date" className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
            <input
              id="appointment-date"
              type="date"
              min={minimumDate}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              className="border border-gray-300 rounded-lg px-4 py-2 mb-4 w-full"
            />
            {date && (
              <>
                <label htmlFor="appointment-time" className="block text-sm font-medium text-gray-700 mb-1">Available time</label>
                {loadingSlots ? <p className="mb-4 text-gray-600">Checking availability...</p> : error ? null : availableTimes.length ? (
                  <select id="appointment-time" value={time} onChange={(event) => setTime(event.target.value)} required className="border border-gray-300 rounded-lg px-4 py-2 mb-4 w-full">
                    {availableTimes.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                  </select>
                ) : <p className="mb-4 text-gray-600">No available times for this date.</p>}
              </>
            )}
            {error && <p role="alert" className="text-red-600 mb-4">{error}</p>}
            <button type="submit" disabled={submitting || loadingSlots || !time} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-semibold">
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
