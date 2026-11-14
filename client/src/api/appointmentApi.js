import axios from "./api";

export const bookAppointment = async (doctorId, date) => {
  const res = await axios.post("/appointments/book", { doctorId, date });
  return res.data;
};

export const getAvailability = async (doctorId, date) => {
  const res = await axios.get('/appointments/availability', { params: { doctorId, date } });
  return res.data;
};


export const getMyAppointments = async () => {
    const res = await axios.get("/appointments/my");
    return res.data;
  };

export const rescheduleAppointment = async (id, date) => {
  const res = await axios.put(`/appointments/${id}/reschedule`, { date });
  return res.data;
};

export const cancelAppointment = async (id) => {
  const res = await axios.put(`/appointments/cancel/${id}`);
  return res.data;
};
