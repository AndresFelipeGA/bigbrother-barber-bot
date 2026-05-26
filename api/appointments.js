'use strict';

const { saveAppointment, getAppointmentsByDate, getAppointmentsByPhone, getAllAppointments, updateAppointmentStatus, deleteAppointment, getAvailableSlots } = require('../src/services/appointments');
const barbershop = require('../src/config/barbershop.json');

/**
 * REST API for appointments.
 * 
 * GET  /api/appointments?date=DD/MM/YYYY        → Get appointments by date
 * GET  /api/appointments?phone=PHONE             → Get appointments by phone
 * GET  /api/appointments?all=true                → Get all appointments
 * GET  /api/appointments?slots=true&date=DD/MM/YYYY → Get available time slots
 * GET  /api/appointments?config=true             → Get barbershop config
 * POST /api/appointments                         → Create new appointment
 * PATCH /api/appointments                        → Update appointment status
 * DELETE /api/appointments?id=ID                  → Delete appointment
 */
module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      case 'PATCH':
        return await handlePatch(req, res);
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

async function handleGet(req, res) {
  const { date, phone, all, slots, config } = req.query;

  // Return barbershop configuration
  if (config === 'true') {
    return res.status(200).json(barbershop);
  }

  // Return available time slots for a date
  if (slots === 'true' && date) {
    const available = await getAvailableSlots(date);
    return res.status(200).json(available);
  }

  // Return all appointments
  if (all === 'true') {
    const adminKey = req.query.key;
    if (adminKey !== (process.env.ADMIN_KEY || 'bigbrother2024')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const appointments = await getAllAppointments();
    return res.status(200).json(appointments);
  }

  // Return appointments by date
  if (date) {
    const appointments = await getAppointmentsByDate(date);
    return res.status(200).json(appointments);
  }

  // Return appointments by phone
  if (phone) {
    const appointments = await getAppointmentsByPhone(phone);
    return res.status(200).json(appointments);
  }

  return res.status(400).json({ error: 'Missing query parameter: date, phone, all, slots, or config' });
}

async function handlePost(req, res) {
  const { customerName, customerPhone, service, barber, date, time } = req.body;

  // Validate required fields
  if (!customerName || !customerPhone || !service || !date || !time) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['customerName', 'customerPhone', 'service', 'date', 'time']
    });
  }

  // Find service details
  const serviceInfo = barbershop.services.find(s => s.name === service);
  if (!serviceInfo) {
    return res.status(400).json({ 
      error: 'Invalid service',
      available: barbershop.services.map(s => s.name)
    });
  }

  // Check if slot is still available
  const available = await getAvailableSlots(date);
  if (!available.includes(time)) {
    return res.status(409).json({ error: 'Time slot no longer available' });
  }

  const appointment = await saveAppointment({
    customerName,
    customerPhone,
    service: serviceInfo.name,
    servicePrice: serviceInfo.price,
    barber: barber || null,
    date,
    time,
    source: 'web',
    status: 'confirmed',
  });

  return res.status(201).json(appointment);
}

async function handlePatch(req, res) {
  const adminKey = req.body.key || req.query.key;
  if (adminKey !== (process.env.ADMIN_KEY || 'bigbrother2024')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ error: 'Missing id or status' });
  }

  const validStatuses = ['confirmed', 'completed', 'cancelled', 'no-show'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status', valid: validStatuses });
  }

  const result = await updateAppointmentStatus(id, status);
  if (!result) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  return res.status(200).json({ success: true, id, status });
}

async function handleDelete(req, res) {
  const adminKey = req.query.key || req.body?.key;
  if (adminKey !== (process.env.ADMIN_KEY || 'bigbrother2024')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing appointment id' });
  }

  const result = await deleteAppointment(id);
  if (!result) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  return res.status(200).json({ success: true, deleted: id });
}
