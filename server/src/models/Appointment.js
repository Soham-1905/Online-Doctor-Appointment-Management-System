const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  date: { type: Date, required: true },
  // Optional for legacy appointments created before time slots were added.
  slotKey: { type: String },
  // Stable identifier for the repeatable demo-data seeder only.
  seedKey: { type: String, select: false },
  status: { type: String, enum: ['upcoming', 'completed', 'cancelled'], default: 'upcoming' }
});

// A slot is exclusive while active. MongoDB enforces this atomically across
// concurrent requests; cancellation releases it for a later booking.
appointmentSchema.index(
  { doctorId: 1, slotKey: 1 },
  { unique: true, partialFilterExpression: { status: 'upcoming', slotKey: { $type: 'string' } } }
);
appointmentSchema.index(
  { seedKey: 1 },
  { unique: true, partialFilterExpression: { seedKey: { $type: 'string' } } }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
