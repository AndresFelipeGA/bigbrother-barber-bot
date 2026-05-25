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
 * @param {object} appointment - { customerPhone, customerName, service, servicePrice, date, time, status }
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

module.exports = {
  saveAppointment,
  getAppointmentsByPhone,
  getAppointmentsByDate,
};
