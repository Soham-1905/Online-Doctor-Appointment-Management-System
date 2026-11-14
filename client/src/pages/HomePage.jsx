import React from "react";
import { Link, useNavigate } from "react-router-dom";
import doctorImg from "../assets/doctor-banner.png";

const features = [
  {
    title: "Create an account",
    description: "Register and sign in to manage your appointments securely.",
  },
  {
    title: "Choose a provider",
    description: "Browse doctors and compare their specialties and clinics.",
  },
  {
    title: "Book a time",
    description: "Check available appointment times and reserve a slot.",
  },
  {
    title: "Stay in control",
    description: "Review upcoming visits, reschedule, or cancel from one place.",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleGetStarted = () => {
    navigate(token ? "/doctors" : "/register");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100">
      <section className="mx-auto grid min-h-[70vh] max-w-7xl items-center gap-10 px-6 py-12 md:grid-cols-2">
        <div className="text-center md:text-left">
          <p className="mb-3 font-semibold uppercase tracking-widest text-blue-700">MedLink care, made simple</p>
          <h1 className="mb-4 text-4xl font-extrabold leading-tight text-blue-900 md:text-5xl">
            Book your doctor appointments, anytime
          </h1>
          <p className="mb-8 text-lg text-gray-700">
            Find a provider, choose an available time, and manage your visits in one place.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row md:justify-start">
            <button
              onClick={handleGetStarted}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-md transition duration-200 hover:bg-blue-700"
            >
              {token ? "Browse Doctors" : "Create Account"}
            </button>
            <Link
              to="/login"
              className="rounded-xl border border-blue-600 px-6 py-3 font-semibold text-blue-700 shadow-sm transition duration-200 hover:bg-blue-50"
            >
              Login
            </Link>
          </div>
          {!token && (
            <p className="mt-4 text-sm text-gray-600">
              New to MedLink? Create an account to book and manage appointments.
            </p>
          )}
        </div>

        <div className="flex justify-center md:justify-end">
          <img
            src={doctorImg}
            alt="Doctor Illustration"
            className="h-72 w-full max-w-md rounded-3xl object-cover shadow-xl md:h-[32rem]"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 font-semibold uppercase tracking-widest text-blue-700">How it works</p>
          <h2 className="text-3xl font-bold text-blue-900">Your appointment, from start to finish</h2>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <li key={feature.title} className="rounded-2xl border border-blue-100 bg-white/90 p-6 shadow-sm">
              <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                {index + 1}
              </span>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="text-sm leading-6 text-gray-600">{feature.description}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
