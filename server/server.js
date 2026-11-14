const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

dotenv.config();

const connectDatabase = require('./config/config');
const authRoutes = require('./src/routes/auth');
const doctorRoutes = require('./src/routes/doctors');
const appointmentRoutes = require('./src/routes/appointments');
const Appointment = require('./src/models/Appointment');

const app = express();
const allowedOrigins = new Set(
    (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
);
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: true,
  }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const port = process.env.PORT || 3030;

app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);

app.get('/', (req, res) => {
    res.send('Hello World!');
});

async function startServer() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured. Set a private random value before starting the server.');
    }
    await connectDatabase();
    // Do not accept traffic until the active-slot uniqueness index is ready.
    await Appointment.init();
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
}

startServer().catch((error) => {
    console.error('Failed to start server:', error.message);
    process.exitCode = 1;
});
