require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Doctor = require('./src/models/Doctor');
const User = require('./src/models/User');
const Appointment = require('./src/models/Appointment');

const demoDoctors = [
  {
    name: 'Dr. Demo Cardiology',
    specialty: 'Cardiology',
    hospital: 'Local Demo Clinic',
    contact: '000-000-0101',
  },
  {
    name: 'Dr. Demo Dermatology',
    specialty: 'Dermatology',
    hospital: 'Local Demo Clinic',
    contact: '000-000-0102',
  },
  {
    name: 'Dr. Demo Pediatrics',
    specialty: 'Pediatrics',
    hospital: 'Local Demo Clinic',
    contact: '000-000-0103',
  },
];

const demoPatients = [
  { name: 'Demo Patient One', email: 'demo.patient@example.test' },
  { name: 'Demo Patient Two', email: 'demo.patient2@example.test' },
];

const demoAppointmentKeys = [
  'demo-patient-one-upcoming',
  'demo-patient-two-upcoming',
  'demo-patient-one-cancelled',
  'demo-patient-one-completed',
];

function atLocalTime(daysFromToday, hour) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function findFreeSlots(doctorId, ignoreAppointmentIds, count) {
  const slots = [];
  const reserved = new Set();
  for (let day = 2; day <= 45 && slots.length < count; day += 1) {
    for (const hour of [9, 10, 11, 13, 14, 15, 16]) {
      const date = atLocalTime(day, hour);
      const slotKey = date.getTime().toString();
      if (reserved.has(slotKey)) continue;
      const occupied = await Appointment.exists({
        doctorId,
        date,
        status: 'upcoming',
        _id: { $nin: ignoreAppointmentIds },
      });
      if (!occupied) {
        slots.push({ date, slotKey });
        reserved.add(slotKey);
        if (slots.length === count) break;
      }
    }
  }
  if (slots.length < count) throw new Error('Could not find enough free demo appointment times.');
  return slots;
}

async function upsertDemoAppointment(seedKey, fields) {
  await Appointment.findOneAndUpdate(
    { seedKey },
    { $set: { ...fields, seedKey } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

async function seedDemoData() {
  let connected = false;
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not set. Copy .env.example to .env and configure it.');
    }

    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    // Ensure the slot uniqueness and seed idempotency indexes exist first.
    await Appointment.init();

    if (await Doctor.countDocuments() === 0) {
      await Doctor.insertMany(demoDoctors);
      console.log(`Inserted ${demoDoctors.length} demo doctors.`);
    } else {
      console.log('Existing doctors found; left them unchanged.');
    }

    const doctor = await Doctor.findOne({ specialty: 'Cardiology' }).sort({ name: 1 }) || await Doctor.findOne().sort({ name: 1 });
    if (!doctor) throw new Error('No doctor is available for demo appointments.');

    const passwordHash = await bcrypt.hash('DemoPatient123!', 10);
    const patients = [];
    for (const patient of demoPatients) {
      const saved = await User.findOneAndUpdate(
        { email: patient.email },
        { $setOnInsert: { ...patient, password: passwordHash, role: 'patient' } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      patients.push(saved);
    }

    const oldDemoAppointments = await Appointment.find({ seedKey: { $in: demoAppointmentKeys } }).select('+seedKey _id');
    const ignoredIds = oldDemoAppointments.map((appointment) => appointment._id);
    const [slotOne, slotTwo] = await findFreeSlots(doctor._id, ignoredIds, 2);
    const yesterday = atLocalTime(-1, 9);

    await upsertDemoAppointment(demoAppointmentKeys[0], {
      userId: patients[0]._id,
      doctorId: doctor._id,
      date: slotOne.date,
      slotKey: slotOne.slotKey,
      status: 'upcoming',
    });
    await upsertDemoAppointment(demoAppointmentKeys[1], {
      userId: patients[1]._id,
      doctorId: doctor._id,
      date: slotTwo.date,
      slotKey: slotTwo.slotKey,
      status: 'upcoming',
    });
    await upsertDemoAppointment(demoAppointmentKeys[2], {
      userId: patients[0]._id,
      doctorId: doctor._id,
      date: slotOne.date,
      slotKey: slotOne.slotKey,
      status: 'cancelled',
    });
    await upsertDemoAppointment(demoAppointmentKeys[3], {
      userId: patients[0]._id,
      doctorId: doctor._id,
      date: yesterday,
      slotKey: yesterday.getTime().toString(),
      status: 'completed',
    });

    console.log(`Demo data ready: ${patients.length} demo patients and ${demoAppointmentKeys.length} demo appointments.`);
    console.log('Demo login: demo.patient@example.test / DemoPatient123!');
    console.log('Demo login: demo.patient2@example.test / DemoPatient123!');
  } catch (error) {
    console.error('Failed to seed demo data:', error.message);
    process.exitCode = 1;
  } finally {
    if (connected) await mongoose.disconnect();
  }
}

seedDemoData();
