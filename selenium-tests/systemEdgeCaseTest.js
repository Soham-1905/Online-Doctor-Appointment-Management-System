const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('../server/node_modules/dotenv').config({ path: require('node:path').resolve(__dirname, '../server/.env') });
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3030/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment_system';
const suffix = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
const email1 = `stqa_${suffix}_one@example.test`;
const email2 = `stqa_${suffix}_two@example.test`;
const password = 'ReviewTest123!';
const testEmails = [email1, email2];
let driver;
let failures = 0;

function check(name, condition) {
  assert.ok(condition, name);
  console.log(`PASS ${name}`);
}

async function api(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, data };
}

async function register(email, role) {
  return api('/auth/register', {
    method: 'POST',
    body: { name: 'STQA Synthetic User', email, password, role },
  });
}

async function login(email) {
  const result = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(result.status, 200, `login failed: ${JSON.stringify(result.data)}`);
  return result.data;
}

async function setDateInput(element, value) {
  await driver.executeScript(
    "const input=arguments[0]; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,arguments[1]); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));",
    element,
    value,
  );
}

async function cleanup() {
  if (driver) await driver.quit().catch(() => {});
  try {
    const mongoose = require('../server/node_modules/mongoose');
    const User = require('../server/src/models/User');
    const Appointment = require('../server/src/models/Appointment');
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    const users = await User.find({ email: { $in: testEmails } }).select('_id');
    const ids = users.map((user) => user._id);
    if (ids.length) await Appointment.deleteMany({ userId: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
    console.log('CLEANUP removed synthetic test users and their appointments');
  } catch (error) {
    failures += 1;
    console.error(`FAIL test data cleanup: ${error.message}`);
  }
}

(async () => {
  try {
    const options = new chrome.Options();
    if (!process.argv.includes('--headed')) options.addArguments('--headless=new');
    options.addArguments('--window-size=1440,1000', '--disable-gpu');
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    await driver.manage().setTimeouts({ implicit: 0, pageLoad: 20000, script: 10000 });

    const doctorsResponse = await api('/doctors');
    assert.equal(doctorsResponse.status, 200);
    const doctor = doctorsResponse.data.find((item) => item.specialty === 'Dermatology') || doctorsResponse.data[0];
    assert.ok(doctor, 'seed at least one doctor before running this system test');
    check('application API and provider data are available', true);

    check('invalid registration input is rejected', (await api('/auth/register', {
      method: 'POST', body: { name: ' ', email: 'bad-email', password: '1' },
    })).status === 400);
    check('invalid login is denied', (await api('/auth/login', {
      method: 'POST', body: { email: email1, password: 'WrongPassword1!' },
    })).status === 401);

    await driver.get(`${APP_URL}/register`);
    await driver.findElement(By.name('name')).sendKeys('STQA Browser Patient');
    await driver.findElement(By.name('email')).sendKeys(email1);
    await driver.findElement(By.name('password')).sendKeys(password);
    await driver.findElement(By.xpath("//button[normalize-space()='Register']")).click();
    await driver.wait(until.urlContains('/login'), 10000);
    check('registration succeeds through the browser', true);
    check('duplicate registration is rejected', (await register(email1, 'patient')).status === 409);
    await driver.findElement(By.css('input[type="email"]')).sendKeys(email1);
    await driver.findElement(By.css('input[type="password"]')).sendKeys(password);
    await driver.findElement(By.xpath("//button[normalize-space()='Login']")).click();
    await driver.wait(until.urlContains('/doctors'), 10000);
    check('login works through the browser', true);

    const search = await driver.findElement(By.id('doctor-search'));
    await search.sendKeys(doctor.specialty);
    await driver.wait(until.elementLocated(By.xpath(`//*[contains(normalize-space(), "${doctor.specialty}")]`)), 5000);
    await search.clear();
    await search.sendKeys('no-provider-matches-this-query');
    await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'No doctors match your search.')]") ), 5000);
    check('provider search and empty results work in the browser', true);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const localDate = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    await search.sendKeys(Key.CONTROL, 'a', Key.BACK_SPACE);
    const bookButton = By.xpath("//button[normalize-space()='Book Now']");
    await driver.wait(until.elementLocated(bookButton), 5000);
    await driver.findElement(bookButton).click();
    await driver.wait(until.urlContains('/book/'), 5000);
    const dateInput = await driver.wait(until.elementLocated(By.id('appointment-date')), 5000);
    await setDateInput(dateInput, localDate);
    let timeInput;
    try {
      timeInput = await driver.wait(until.elementLocated(By.id('appointment-time')), 8000);
    } catch (error) {
      console.error(`BOOK DEBUG date=${await dateInput.getAttribute('value')} page=${await driver.findElement(By.tagName('body')).getText()}`);
      throw error;
    }
    const selectedTime = await timeInput.getAttribute('value');
    assert.ok(selectedTime, 'availability endpoint must return at least one future slot');
    await driver.findElement(By.xpath("//button[normalize-space()='Confirm Booking']")).click();
    await driver.wait(until.urlContains('/appointments'), 10000);
    await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'Appointment booked successfully.')]") ), 5000);
    check('a future appointment can be booked through the browser', true);

    const token1 = await driver.executeScript('return localStorage.getItem("token")');
    const mine = await api('/appointments/my', { token: token1 });
    assert.equal(mine.status, 200);
    const booked = mine.data.find((item) => item.status === 'upcoming');
    assert.ok(booked, 'new booking should appear in the patient appointment list');
    const bookedDoctorId = booked.doctorId._id;
    const slotDate = new Date(booked.date);
    const slotStamp = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, '0')}-${String(slotDate.getDate()).padStart(2, '0')}T${String(slotDate.getHours()).padStart(2, '0')}:${String(slotDate.getMinutes()).padStart(2, '0')}:00`;
    check('appointment list returns the current user booking', true);

    check('past appointment date is rejected', (await api('/appointments/book', {
      method: 'POST', token: token1, body: { doctorId: bookedDoctorId, date: '2000-01-01T09:00:00' },
    })).status === 400);
    check('same-slot duplicate submission is rejected', (await api('/appointments/book', {
      method: 'POST', token: token1, body: { doctorId: bookedDoctorId, date: slotStamp },
    })).status === 409);

    check('second synthetic user registration succeeds', (await register(email2, 'admin')).status === 201);
    const secondLogin = await login(email2);
    const token2 = secondLogin.token;
    check('public registration cannot grant admin role', secondLogin.user.role === 'patient');
    check('appointment records are private to their owner', (await api('/appointments/my', { token: token2 })).data.length === 0);
    check('another user cannot cancel an appointment', (await api(`/appointments/cancel/${booked._id}`, {
      method: 'PUT', token: token2,
    })).status === 404);
    check('malformed appointment IDs are rejected', (await api('/appointments/cancel/not-an-id', {
      method: 'PUT', token: token1,
    })).status === 400);

    const nextDay = new Date(slotDate);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(13, 0, 0, 0);
    const rescheduled = await api(`/appointments/${booked._id}/reschedule`, {
      method: 'PUT', token: token1, body: { date: `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T13:00:00` },
    });
    check('appointment can be rescheduled to a future available slot', rescheduled.status === 200);
    const secondDay = new Date(nextDay);
    secondDay.setDate(secondDay.getDate() + 1);
    secondDay.setHours(14, 0, 0, 0);
    const raceDate = `${secondDay.getFullYear()}-${String(secondDay.getMonth() + 1).padStart(2, '0')}-${String(secondDay.getDate()).padStart(2, '0')}T14:00:00`;
    const raceResults = await Promise.all([
      api('/appointments/book', { method: 'POST', token: token1, body: { doctorId: bookedDoctorId, date: raceDate } }),
      api('/appointments/book', { method: 'POST', token: token2, body: { doctorId: bookedDoctorId, date: raceDate } }),
    ]);
    check('concurrent slot claims produce one booking and one conflict', raceResults.map((item) => item.status).sort().join(',') === '201,409');
    check('rescheduling into an occupied slot is prevented', (await api(`/appointments/${booked._id}/reschedule`, {
      method: 'PUT', token: token1, body: { date: raceDate },
    })).status === 409);

    const expired = require('../server/node_modules/jsonwebtoken').sign(
      { id: '000000000000000000000001', role: 'patient' },
      process.env.JWT_SECRET || 'end-to-end-test-secret-2026-only-do-not-reuse',
      { expiresIn: -1 },
    );
    check('expired session is denied on protected routes', (await api('/appointments/my', { token: expired })).status === 401);

    check('owner can cancel a future appointment', (await api(`/appointments/cancel/${booked._id}`, {
      method: 'PUT', token: token1,
    })).status === 200);
    check('repeated cancellation is handled safely', (await api(`/appointments/cancel/${booked._id}`, {
      method: 'PUT', token: token1,
    })).status === 409);
    console.log('SYSTEM TEST RESULT: all scenarios passed');
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${error.stack || error.message}`);
  } finally {
    await cleanup();
  }
  if (failures) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
