const express = require('express');
const {
  bookAppointment,
  getMyAppointments,
  getAvailability,
  rescheduleAppointment,
  cancelAppointment,
} = require('../controllers/appointmentController');
const verifyToken = require('../validations/authMiddleware');
const router = express.Router();

router.post('/book', verifyToken, bookAppointment);
router.get('/my', verifyToken, getMyAppointments);
router.get('/availability', getAvailability);
router.put('/:id/reschedule', verifyToken, rescheduleAppointment);
router.put('/cancel/:id', verifyToken, cancelAppointment);

module.exports = router;
