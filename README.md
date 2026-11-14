# MedLink Online Doctor Appointment System

MedLink is a local MERN application for registering and signing in as a patient, finding providers, booking available appointment slots, and managing upcoming appointments. It includes a Selenium end-to-end test suite.

## Features

- Patient registration and login using JWT authentication
- Provider search and selection
- Time-slot availability lookup and appointment booking
- Patient appointment list, rescheduling, and cancellation
- Admin-only provider creation

## Technology

- Frontend: React, Vite, Tailwind CSS, Axios
- Backend: Node.js, Express, Mongoose, JWT
- Database: MongoDB
- Browser tests: Selenium WebDriver and Chrome

## Local setup (Windows)

### Prerequisites

- Node.js (LTS)
- MongoDB Community Server installed as a Windows service
- Google Chrome (needed for Selenium tests)

Mongoose is the Node.js library used to connect to MongoDB; it does not install the MongoDB server.

### 1. Start MongoDB

The MongoDB service should be running on port `27017`. If it is installed but stopped, start PowerShell as Administrator and run:

```powershell
Start-Service MongoDB
```

### 2. Configure and run the backend

From the repository root, open a PowerShell terminal:

```powershell
cd server
npm.cmd install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Check `server/.env` and set a private `JWT_SECRET`. The default database URI is:

```text
mongodb://127.0.0.1:27017/online_doctor_appointment_system
```

Seed demo providers (only adds them when no doctors exist), then start the backend:

```powershell
npm.cmd run seed
npm.cmd run dev
```

The API is at `http://localhost:3030`. The server waits for MongoDB before listening.

### 3. Run the frontend

Open a second PowerShell terminal from the repository root:

```powershell
cd client
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`.

### 4. Use the app

1. Register a patient account and sign in.
2. Browse/search doctors and choose **Book Now**.
3. Select a future date and an available time.
4. Find upcoming visits under **My Appointments** to reschedule or cancel.

The seeded provider profiles are demo data. Replace them with real provider details before using the app beyond local testing.

## API reference

Base URL: `http://localhost:3030`

Send JSON requests with the `Content-Type: application/json` header. For protected endpoints, set:

```text
Authorization: Bearer <token-from-login>
```

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/` | None | Backend health check |
| `POST` | `/api/auth/register` | None | Register a patient |
| `POST` | `/api/auth/login` | None | Log in and receive a JWT |
| `GET` | `/api/doctors` | None | List all providers |
| `POST` | `/api/doctors/add` | Admin | Add a provider |
| `GET` | `/api/appointments/availability` | None | Get open times for a provider and date |
| `POST` | `/api/appointments/book` | Patient JWT | Book a time |
| `GET` | `/api/appointments/my` | Patient JWT | List the signed-in patient's appointments |
| `PUT` | `/api/appointments/:id/reschedule` | Appointment owner's JWT | Reschedule an upcoming appointment |
| `PUT` | `/api/appointments/cancel/:id` | Appointment owner's JWT | Cancel an upcoming appointment |

### Authentication

#### Register

`POST /api/auth/register`

```json
{
  "name": "Sam Patient",
  "email": "sam@example.com",
  "password": "Secure123!"
}
```

Returns `201 Created`. Name must be 2–100 characters, email must be valid, and password must be 6–128 characters. Public registration always creates a `patient`; sending `"role": "admin"` does not grant admin access. Duplicate email returns `409 Conflict`.

#### Login

`POST /api/auth/login`

```json
{
  "email": "sam@example.com",
  "password": "Secure123!"
}
```

Returns `200 OK` with a JWT and the user's name, email, and role. Save the `token` for protected requests. Invalid credentials return `401 Unauthorized`.

### Providers

#### List providers

`GET /api/doctors`

Returns an array of providers. Run `npm.cmd run seed` in `server` if the local database has no demo providers.

#### Add a provider

`POST /api/doctors/add` — admin token required.

```json
{
  "name": "Dr. Example",
  "specialty": "Cardiology",
  "hospital": "Example Clinic",
  "contact": "555-0100"
}
```

Returns `201 Created`. All four fields are required strings of up to 150 characters. Invalid fields return `400`; missing/invalid authentication returns `401`; a patient token returns `403`.

There is no public API for creating an admin account. Public registration cannot grant the admin role; use an admin account provisioned for your local environment to test this endpoint.

#### Create a local admin account for testing

1. Register your account normally through the app.
2. Connect MongoDB Compass to `mongodb://127.0.0.1:27017`, open the `online_doctor_appointment_system` database and its `users` collection, then change that account's `role` field from `patient` to `admin`.

   Or, in `mongosh`, run:

   ```javascript
   use online_doctor_appointment_system
   db.users.updateOne(
     { email: "sam@example.com" },
     { $set: { role: "admin" } }
   )
   ```

3. Log out of MedLink and log back in so a new JWT is issued with the admin role. The admin navigation then exposes **Add Doctor**.

Only do this in your local development database. Do not add a public role selector to registration.

### Appointments

The supported time slots are `09:00`, `10:00`, `11:00`, `13:00`, `14:00`, `15:00`, and `16:00` in the server's local time zone. Only future, unbooked slots are returned. The date and time sent when booking or rescheduling should use that same local time zone.

#### Check availability

`GET /api/appointments/availability?doctorId={{doctorId}}&date={{appointmentDate}}`

`appointmentDate` must use `YYYY-MM-DD` format. Use a future date to get available times; past dates or dates whose slots have passed return an empty array. A successful response is an array of available times, for example:

```json
["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"]
```

#### Book an appointment

`POST /api/appointments/book` — patient token required.

```json
{
  "doctorId": "{{doctorId}}",
  "date": "{{appointmentDate}}T09:00:00"
}
```

Returns `201 Created` with the appointment. The provider must exist, the date/time must be in the future, and the time must be one of the slots returned by availability. An already-taken slot returns `409 Conflict`.

#### List your appointments

`GET /api/appointments/my` — patient token required.

Returns the signed-in patient's appointments, ordered by date, including provider details and appointment status.

#### Reschedule an appointment

`PUT /api/appointments/{{appointmentId}}/reschedule` — appointment owner's token required.

```json
{
  "date": "{{rescheduledDate}}T13:00:00"
}
```

Use a future date and an available time. A non-owner cannot modify the appointment. A taken slot returns `409 Conflict`.

#### Cancel an appointment

`PUT /api/appointments/cancel/{{appointmentId}}` — appointment owner's token required. No request body is needed. A successful response includes `"Appointment cancelled."`. Only the owner's upcoming appointment can be cancelled.

## Test with Postman

1. Start MongoDB, the backend, and the frontend using the setup steps above.
2. In Postman, create an environment with these variables:

   | Variable | Example |
   |---|---|
   | `baseUrl` | `http://localhost:3030` |
   | `token` | Set from the login response |
   | `doctorId` | Set from a doctor response |
   | `appointmentId` | Set from a booking response |
   | `appointmentDate` | A future date, such as `2026-11-15` |
   | `rescheduledDate` | A different future date |

   Replace the example dates with future dates when running the requests.

3. Send `POST {{baseUrl}}/api/auth/register`, then `POST {{baseUrl}}/api/auth/login`.
4. On the login request's **Scripts → Post-response** tab, save the token:

   ```javascript
   pm.environment.set("token", pm.response.json().token);
   ```

5. Send `GET {{baseUrl}}/api/doctors`. Save a returned provider ID:

   ```javascript
   const doctors = pm.response.json();
   pm.test("At least one provider is available", () => {
     pm.expect(doctors.length).to.be.greaterThan(0);
   });
   if (doctors.length) pm.environment.set("doctorId", doctors[0]._id);
   ```

6. Send the availability request and choose one of its returned times.
7. For booking, set **Authorization → Bearer Token** to `{{token}}`. After a successful booking, save its ID:

   ```javascript
   pm.environment.set("appointmentId", pm.response.json()._id);
   ```

8. Use the same Bearer Token setting for **My Appointments**, **Reschedule**, and **Cancel**.

When testing rescheduling, choose a future slot that is not already booked. Cancellation changes the appointment status to `cancelled` and releases its slot.

## Run Selenium tests

Keep MongoDB and both app servers running. In a separate PowerShell terminal:

```powershell
cd selenium-tests
npm.cmd install
npm.cmd test
```

`npm.cmd test` runs Chrome headlessly and prints each `PASS` result in the terminal. To watch the browser interact with the app:

```powershell
npm.cmd run test:headed
```

The suite covers registration, login, provider search, availability, booking, appointment privacy, rescheduling, and cancellation. It creates uniquely named synthetic users and removes their test appointments and accounts during cleanup.

## Troubleshooting

- **Availability request returns 404 / `Cannot GET`:** restart the backend from `server` with `npm.cmd run dev` so it loads the current routes.
- **Availability request fails to connect:** confirm the backend is listening on port `3030` and MongoDB is running.
- **No providers are listed:** run `npm.cmd run seed` from `server`; it only inserts demo providers when the collection is empty.
- **Protected endpoint returns 401:** log in again and send `Authorization: Bearer <token>`.
- **Add provider returns 403:** the token belongs to a patient; a locally provisioned admin account is required.

## Project layout

- `client/` — React and Vite frontend
- `server/` — Express API, MongoDB models, and demo-provider seed script
- `selenium-tests/` — Selenium system tests
