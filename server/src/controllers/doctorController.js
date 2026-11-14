const Doctor = require('../models/Doctor');


//get all doctors
exports.getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find();
    res.status(200).json(doctors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
};


//add a new doctor
exports.addDoctor = async (req, res) => {
  const { name, specialty, hospital, contact } = req.body || {};
  const fields = { name, specialty, hospital, contact };
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 150) {
      return res.status(400).json({ error: `${field} must contain between 1 and 150 characters.` });
    }
  }
  try {
    const doctor = await Doctor.create(Object.fromEntries(Object.entries(fields).map(([field, value]) => [field, value.trim()])));
    res.status(201).json(doctor);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add doctor' });
  }
};
