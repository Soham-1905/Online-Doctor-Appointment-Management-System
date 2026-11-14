const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');

const SLOT_TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

function parseAppointmentDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFuture(date) {
  // Date-only values represent an appointment day, not midnight on that day.
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return day >= today && date > new Date();
}

function validId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function isDuplicateSlot(error) {
  return error?.code === 11000;
}

function isValidSlot(date) {
  return SLOT_TIMES.includes(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`)
    && date.getSeconds() === 0
    && date.getMilliseconds() === 0;
}

exports.getAvailability = async (req, res) => {
  const { doctorId, date } = req.query;
  if (!validId(doctorId) || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'A valid doctorId and date (YYYY-MM-DD) are required.' });
  }
  try {
    if (!await Doctor.exists({ _id: doctorId })) return res.status(404).json({ error: 'Doctor not found.' });
    const [year, month, day] = date.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) {
      return res.status(400).json({ error: 'Invalid date.' });
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const booked = await Appointment.find({ doctorId, date: { $gte: start, $lt: end }, status: 'upcoming' }).select('date');
    const unavailable = new Set(booked.map((appointment) => {
      const value = appointment.date;
      return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
    }));
    const now = new Date();
    return res.json(SLOT_TIMES.filter((time) => {
      const slotDate = new Date(`${date}T${time}:00`);
      return slotDate > now && !unavailable.has(time);
    }));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to check availability.' });
  }
};

exports.bookAppointment = async (req, res) => {
  const { doctorId, date } = req.body || {};
  const appointmentDate = parseAppointmentDate(date);
  if (!validId(doctorId)) return res.status(400).json({ error: 'A valid doctor is required.' });
  if (!appointmentDate) return res.status(400).json({ error: 'A valid appointment date and time are required.' });
  if (!isFuture(appointmentDate)) return res.status(400).json({ error: 'Appointments must be booked for a future time.' });
  if (!isValidSlot(appointmentDate)) {
    return res.status(400).json({ error: 'Choose an available appointment time.' });
  }

  try {
    if (!await Doctor.exists({ _id: doctorId })) return res.status(404).json({ error: 'Doctor not found.' });
    if (await Appointment.exists({ doctorId, date: appointmentDate, status: 'upcoming' })) {
      return res.status(409).json({ error: 'This appointment slot is no longer available.' });
    }
    const appointment = await Appointment.create({
      userId: req.user.id,
      doctorId,
      date: appointmentDate,
      slotKey: appointmentDate.getTime().toString(),
    });
    return res.status(201).json(appointment);
  } catch (error) {
    if (isDuplicateSlot(error)) return res.status(409).json({ error: 'This appointment slot is no longer available.' });
    return res.status(500).json({ error: 'Booking failed. Please try again.' });
  }
};

exports.getMyAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ userId: req.user.id })
      .populate('doctorId', 'name specialty hospital contact')
      .sort({ date: 1 });
    return res.status(200).json(appointments);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch appointments.' });
  }
};

exports.rescheduleAppointment = async (req, res) => {
  const { date } = req.body || {};
  const appointmentDate = parseAppointmentDate(date);
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid appointment ID.' });
  if (!appointmentDate || !isFuture(appointmentDate)) return res.status(400).json({ error: 'Choose a valid future date and time.' });
  if (!isValidSlot(appointmentDate)) {
    return res.status(400).json({ error: 'Choose an available appointment time.' });
  }
  try {
    const current = await Appointment.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: 'upcoming',
      date: { $gt: new Date() },
    }).select('doctorId');
    if (!current) {
      const owned = await Appointment.exists({ _id: req.params.id, userId: req.user.id });
      if (!owned) return res.status(404).json({ error: 'Appointment not found.' });
      return res.status(409).json({ error: 'This appointment can no longer be rescheduled.' });
    }
    if (await Appointment.exists({
      doctorId: current.doctorId,
      date: appointmentDate,
      status: 'upcoming',
      _id: { $ne: req.params.id },
    })) {
      return res.status(409).json({ error: 'This appointment slot is no longer available.' });
    }
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, status: 'upcoming', date: { $gt: new Date() } },
      { $set: { date: appointmentDate, slotKey: appointmentDate.getTime().toString() } },
      { new: true, runValidators: true }
    ).populate('doctorId', 'name specialty hospital contact');
    if (!appointment) {
      const owned = await Appointment.exists({ _id: req.params.id, userId: req.user.id });
      if (!owned) return res.status(404).json({ error: 'Appointment not found.' });
      return res.status(409).json({ error: 'This appointment can no longer be rescheduled.' });
    }
    return res.json(appointment);
  } catch (error) {
    if (isDuplicateSlot(error)) return res.status(409).json({ error: 'This appointment slot is no longer available.' });
    return res.status(500).json({ error: 'Failed to reschedule appointment.' });
  }
};

exports.cancelAppointment = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid appointment ID.' });
  try {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, status: 'upcoming', date: { $gt: new Date() } },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    if (!appointment) {
      const owned = await Appointment.exists({ _id: req.params.id, userId: req.user.id });
      if (!owned) return res.status(404).json({ error: 'Appointment not found.' });
      return res.status(409).json({ error: 'This appointment can no longer be cancelled.' });
    }
    return res.json({ message: 'Appointment cancelled.', appointment });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to cancel appointment.' });
  }
};
