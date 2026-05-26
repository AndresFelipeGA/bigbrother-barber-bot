'use strict';

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

/**
 * MongoDB Atlas connection.
 * Uses connection pooling - the client is reused across invocations
 * in Vercel serverless functions (warm starts).
 * 
 * MongoDB Atlas M0 (Free Tier):
 * - 512MB storage (FREE FOREVER)
 * - Shared cluster
 * - Perfect for a barbershop
 */
let cachedClient = null;
let cachedDb = null;

const DB_NAME = 'bigbrother_barber';
const COLLECTION_NAME = 'appointments';

/**
 * Connects to MongoDB Atlas (or returns cached connection).
 */
async function getDatabase() {
  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  const client = new MongoClient(uri);
  await client.connect();

  cachedClient = client;
  cachedDb = client.db(DB_NAME);

  console.log('Connected to MongoDB Atlas');
  return cachedDb;
}

/**
 * Saves a new appointment to MongoDB.
 * @param {object} appointment - { customerPhone, customerName, service, servicePrice, date, time, status, source }
 * @returns {object} The saved appointment document
 */
async function saveAppointment(appointment) {
  const db = await getDatabase();
  const collection = db.collection(COLLECTION_NAME);

  const doc = {
    _id: uuidv4(),
    customerPhone: appointment.customerPhone,
    customerName: appointment.customerName,
    service: appointment.service,
    servicePrice: appointment.servicePrice,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status || 'confirmed',
    source: appointment.source || 'whatsapp',
    createdAt: new Date().toISOString(),
  };

  await collection.insertOne(doc);
  console.log('Appointment saved:', JSON.stringify(doc));
  return doc;
}

/**
 * Gets all appointments for a phone number.
 * @param {string} phone - Customer phone number
 * @returns {Array} List of appointments
 */
async function getAppointmentsByPhone(phone) {
  const db = await getDatabase();
  const collection = db.collection(COLLECTION_NAME);

  const appointments = await collection
    .find({ customerPhone: phone })
    .sort({ createdAt: -1 })
    .toArray();

  return appointments;
}

/**
 * Gets all appointments for a specific date.
 * @param {string} date - Date string (DD/MM/YYYY)
 * @returns {Array} List of appointments for that date
 */
async function getAppointmentsByDate(date) {
  const db = await getDatabase();
  const collection = db.collection(COLLECTION_NAME);

  const appointments = await collection
    .find({ date, status: 'confirmed' })
    .sort({ time: 1 })
    .toArray();

  return appointments;
}

/**
 * Gets ALL appointments (for admin panel).
 * Returns most recent first, limited to 200.
 * @returns {Array} List of all appointments
 */
async function getAllAppointments() {
  const db = await getDatabase();
  const collection = db.collection(COLLECTION_NAME);

  const appointments = await collection
    .find({})
    .sort({ date: -1, time: -1 })
    .limit(200)
    .toArray();

  return appointments;
}

/**
 * Updates the status of an appointment.
 * @param {string} id - Appointment ID
 * @param {string} status - New status (confirmed, completed, cancelled, no-show)
 * @returns {boolean} True if updated, false if not found
 */
async function updateAppointmentStatus(id, status) {
  const db = await getDatabase();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.updateOne(
    { _id: id },
    { $set: { status, updatedAt: new Date().toISOString() } }
  );

  return result.matchedCount > 0;
}

/**
 * Deletes an appointment.
 * @param {string} id - Appointment ID
 * @returns {boolean} True if deleted, false if not found
 */
async function deleteAppointment(id) {
  const db = await getDatabase();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

/**
 * Gets the current date/time in Colombia timezone (UTC-5).
 * Always uses Colombia time regardless of server location.
 * @returns {Date} Date object adjusted to Colombia time
 */
function getColombiaTime() {
  const now = new Date();
  // Get UTC time, then subtract 5 hours for Colombia (UTC-5)
  const colombiaOffset = -5 * 60; // minutes
  const utcMinutes = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMinutes + (colombiaOffset * 60000));
}

/**
 * Gets available time slots for a given date.
 * Generates 1-hour slots based on barbershop schedule and removes already booked ones.
 * For today's date, only shows slots starting from the next full hour (Colombia time).
 * @param {string} date - Date string (DD/MM/YYYY)
 * @returns {Array<string>} Available time slots (e.g., ["9:00 AM", "10:00 AM", ...])
 */
async function getAvailableSlots(date) {
  const barbershop = require('../config/barbershop.json');

  // Parse date to get day of week
  const [day, month, year] = date.split('/').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayName = days[dateObj.getDay()];

  const scheduleStr = barbershop.schedule[dayName];
  if (!scheduleStr || scheduleStr === 'Cerrado') {
    return [];
  }

  // Parse schedule "9:00 AM - 8:00 PM"
  const [openStr, closeStr] = scheduleStr.split(' - ');
  const openMinutes = parseTimeToMinutes(openStr);
  const closeMinutes = parseTimeToMinutes(closeStr);

  // Generate 1-hour slots (last slot must end before closing)
  const allSlots = [];
  for (let m = openMinutes; m <= closeMinutes - 60; m += 60) {
    allSlots.push(minutesToTimeStr(m));
  }

  // Get booked appointments for this date
  const booked = await getAppointmentsByDate(date);
  const bookedTimes = new Set(booked.map(a => a.time));

  // Filter out booked slots
  let available = allSlots.filter(slot => !bookedTimes.has(slot));

  // If the requested date is TODAY (Colombia time), filter out past hours
  const colombiaNow = getColombiaTime();
  const todayStr = `${String(colombiaNow.getDate()).padStart(2, '0')}/${String(colombiaNow.getMonth() + 1).padStart(2, '0')}/${colombiaNow.getFullYear()}`;

  if (date === todayStr) {
    // Current time in minutes since midnight (Colombia)
    const currentMinutes = colombiaNow.getHours() * 60 + colombiaNow.getMinutes();
    // Next full hour: if it's 8:03, next available is 9:00 (540 min)
    const nextFullHour = (Math.floor(currentMinutes / 60) + 1) * 60;

    available = available.filter(slot => {
      const slotMinutes = parseTimeToMinutes(slot);
      return slotMinutes >= nextFullHour;
    });
  }

  return available;
}

/**
 * Parses a time string like "9:00 AM" or "8:00 PM" to minutes since midnight.
 */
function parseTimeToMinutes(timeStr) {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Converts minutes since midnight to a time string like "9:00 AM".
 */
function minutesToTimeStr(totalMinutes) {
  let hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';

  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;

  return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

module.exports = {
  saveAppointment,
  getAppointmentsByPhone,
  getAppointmentsByDate,
  getAllAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  getAvailableSlots,
};
