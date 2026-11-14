import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import doctorImg from "../assets/doctor-banner.png";
import { registerUser } from "../api/authApi";
import { registerSchema } from "../validations/registerSchema";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Handle input change
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

    // Handle registration
  const handleRegister = async () => {
    setErrors({});
    setFormError('');
    try {
      const validated = await registerSchema.validate(form, { abortEarly: false });
      setSubmitting(true);
      await registerUser({ ...validated, name: validated.name.trim(), email: validated.email.trim().toLowerCase() });
      navigate("/login");
    } catch (err) {
      if (err.name === "ValidationError") {
        const validationErrors = {};
        err.inner.forEach((e) => {
          validationErrors[e.path] = e.message;
        });
        setErrors(validationErrors);
      } else {
        setFormError(err.response?.data?.error || 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 px-6">
      <div className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl grid md:grid-cols-2 overflow-hidden">
        {/* Image */}
        <div className="hidden md:flex items-center justify-center bg-blue-50">
          <img src={doctorImg} alt="Register" className="w-full h-full object-cover" />
        </div>

        {/* Form */}
        <div className="p-10 flex flex-col justify-center">
          <h2 className="text-3xl font-bold text-blue-800 mb-6">Create a New Account</h2>
          <div className="space-y-4">
            <div>
              <input
                name="name"
                placeholder="Full Name"
                value={form.name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <input
                name="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <input
                name="password"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
            </div>
          </div>

          {formError && <p role="alert" className="mt-4 text-sm text-red-600">{formError}</p>}
          <button
            onClick={handleRegister}
            disabled={submitting}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white w-full py-3 rounded-lg font-semibold transition duration-200"
          >
            {submitting ? 'Registering...' : 'Register'}
          </button>

          <p className="text-center mt-4 text-gray-600">
            Already have an account?{" "}
            <span
              className="text-blue-600 font-medium cursor-pointer hover:underline"
              onClick={() => navigate("/login")}
            >
              Login
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
