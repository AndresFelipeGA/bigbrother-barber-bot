'use strict';

// Use Baileys transport (swap to './whatsapp' for Meta Cloud API)
const { sendTextMessage, sendLocationMessage, sendListMessage, sendButtonMessage } = require('./whatsapp-baileys');
const { saveAppointment } = require('./appointments');
const barbershop = require('../config/barbershop.json');

/**
 * In-memory session store for appointment flow.
 * In Lambda, this resets on cold starts - which is fine for a small barbershop.
 * Each session tracks where the user is in the appointment booking flow.
 */
const sessions = {};

// Session timeout: 10 minutes
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Main entry point: processes an incoming WhatsApp message.
 * Detects the user's intent and responds accordingly.
 */
async function processMessage({ from, customerName, messageText, messageType }) {
  console.log(`Processing message from ${from}: "${messageText}"`);

  // Check if user is in an active appointment flow
  const session = getSession(from);
  if (session && session.step) {
    return handleAppointmentFlow(from, customerName, messageText, session);
  }

  // Detect intent from the message text
  const intent = detectIntent(messageText);
  console.log(`Detected intent: ${intent}`);

  switch (intent) {
    case 'greeting':
      return sendWelcomeMenu(from, customerName);
    case 'hours':
      return sendHours(from);
    case 'services':
      return sendServices(from);
    case 'location':
      return sendLocation(from);
    case 'appointment':
      return startAppointmentFlow(from, customerName);
    case 'human':
      return sendHumanTransfer(from, customerName);
    case 'thanks':
      return sendThanks(from, customerName);
    case 'cancel':
      return sendCancel(from);
    default:
      return sendDefaultMenu(from);
  }
}

// ============================================================
// Intent Detection
// ============================================================

/**
 * Simple keyword-based intent detection.
 * Normalizes text (lowercase, no accents) and matches against keyword lists.
 */
function detectIntent(text) {
  const normalized = normalizeText(text);

  // Check for menu number selections first
  if (/^1$/.test(normalized)) return 'hours';
  if (/^2$/.test(normalized)) return 'services';
  if (/^3$/.test(normalized)) return 'location';
  if (/^4$/.test(normalized)) return 'appointment';
  if (/^5$/.test(normalized)) return 'human';

  // Keyword matching
  const intents = {
    greeting: ['hola', 'buenas', 'buenos', 'hey', 'hi', 'hello', 'que tal', 'buenas tardes', 'buenas noches', 'buenos dias', 'buen dia', 'ola', 'saludos', 'holi'],
    hours: ['horario', 'horarios', 'hora', 'horas', 'abierto', 'abren', 'cierran', 'cierre', 'apertura', 'atienden', 'atencion', 'cuando'],
    services: ['servicio', 'servicios', 'precio', 'precios', 'cuanto', 'cuesta', 'cobran', 'cobrar', 'tarifa', 'corte', 'barba', 'afeitado', 'tratamiento', 'lista', 'menu'],
    location: ['ubicacion', 'direccion', 'donde', 'queda', 'quedan', 'mapa', 'llegar', 'como llego', 'maps', 'gps', 'lugar'],
    appointment: ['cita', 'agendar', 'reservar', 'reserva', 'turno', 'apartar', 'disponibilidad', 'disponible', 'agenda'],
    human: ['humano', 'persona', 'hablar', 'asesor', 'ayuda', 'operador', 'agente', 'alguien', 'contacto', 'llamar', 'numero'],
    thanks: ['gracias', 'gracia', 'thanks', 'thank', 'vale', 'listo', 'perfecto', 'genial', 'excelente', 'chevere', 'bacano'],
    cancel: ['cancelar', 'salir', 'no', 'nada', 'ya no', 'olvidalo', 'dejalo'],
  };

  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return intent;
    }
  }

  return 'unknown';
}

/**
 * Normalizes text: lowercase, remove accents, trim.
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ============================================================
// Response Handlers
// ============================================================

/**
 * Sends the welcome message with the main menu.
 */
async function sendWelcomeMenu(to, customerName) {
  const name = customerName ? ` ${customerName.split(' ')[0]}` : '';
  const message =
    `¡Hola${name}! 👋 Bienvenido a *${barbershop.name}* ${barbershop.emoji}\n` +
    `${barbershop.slogan}\n\n` +
    `¿En qué podemos ayudarte?\n\n` +
    `1️⃣ Horarios de atención\n` +
    `2️⃣ Servicios y precios\n` +
    `3️⃣ Ubicación\n` +
    `4️⃣ Agendar una cita\n` +
    `5️⃣ Hablar con alguien del equipo\n\n` +
    `Escribe el *número* de la opción o tu pregunta 😊`;

  return sendTextMessage(to, message);
}

/**
 * Sends the barbershop schedule.
 */
async function sendHours(to) {
  let scheduleText = '';
  for (const [day, hours] of Object.entries(barbershop.schedule)) {
    const emoji = hours === 'Cerrado' ? '🔴' : '📅';
    scheduleText += `${emoji} *${day}*: ${hours}\n`;
  }

  const message =
    `🕐 *Horarios de ${barbershop.name}*\n\n` +
    `${scheduleText}\n` +
    `¡Te esperamos! ${barbershop.emoji}\n\n` +
    `_Escribe *hola* para volver al menú_`;

  return sendTextMessage(to, message);
}

/**
 * Sends the services and prices list.
 */
async function sendServices(to) {
  let servicesText = '';
  for (const service of barbershop.services) {
    const price = formatPrice(service.price);
    servicesText += `${service.emoji} *${service.name}* — ${price}\n`;
  }

  const message =
    `${barbershop.emoji} *Servicios de ${barbershop.name}*\n\n` +
    `${servicesText}\n` +
    `¿Te gustaría agendar una cita? Escribe *4* 📅\n\n` +
    `_Escribe *hola* para volver al menú_`;

  return sendTextMessage(to, message);
}

/**
 * Sends the barbershop location with a Google Maps link and location pin.
 */
async function sendLocation(to) {
  const loc = barbershop.location;

  // First send text with the link
  const message =
    `📍 *Ubicación de ${barbershop.name}*\n\n` +
    `Estamos en: ${loc.address}\n\n` +
    `📌 Google Maps: ${loc.googleMapsUrl}\n\n` +
    `¡Te esperamos! ${barbershop.emoji}\n\n` +
    `_Escribe *hola* para volver al menú_`;

  await sendTextMessage(to, message);

  // Then send the location pin
  return sendLocationMessage(to, {
    latitude: loc.latitude,
    longitude: loc.longitude,
    name: barbershop.name,
    address: loc.address,
  });
}

/**
 * Sends a message to transfer to a human.
 */
async function sendHumanTransfer(to, customerName) {
  const ownerPhone = process.env.OWNER_PHONE || '';

  const message =
    `👤 *Contacto con el equipo*\n\n` +
    `Entendemos que prefieres hablar con una persona. ` +
    `Un miembro de nuestro equipo te contactará lo antes posible.\n\n` +
    `También puedes llamarnos o escribirnos directamente:\n` +
    `📞 wa.me/${ownerPhone}\n\n` +
    `¡Gracias por tu paciencia! 🙏\n\n` +
    `_Escribe *hola* para volver al menú_`;

  await sendTextMessage(to, message);

  // Notify the owner that someone wants to talk to a human
  if (ownerPhone) {
    const notifyMessage =
      `🔔 *Solicitud de atención humana*\n\n` +
      `El cliente *${customerName}* (${to}) quiere hablar con alguien del equipo.\n` +
      `Escríbele directamente: wa.me/${to}`;

    try {
      await sendTextMessage(ownerPhone, notifyMessage);
    } catch (err) {
      console.error('Failed to notify owner:', err.message);
    }
  }
}

/**
 * Sends a thank you message.
 */
async function sendThanks(to, customerName) {
  const name = customerName ? ` ${customerName.split(' ')[0]}` : '';
  const message =
    `¡Gracias a ti${name}! 🙏 En *${barbershop.name}* siempre es un placer atenderte.\n\n` +
    `Si necesitas algo más, escribe *hola* 😊`;

  return sendTextMessage(to, message);
}

/**
 * Sends a cancel/goodbye message.
 */
async function sendCancel(to) {
  // Clear any active session
  clearSession(to);

  const message =
    `¡Entendido! Si necesitas algo más adelante, solo escribe *hola* 👋\n\n` +
    `*${barbershop.name}* ${barbershop.emoji}`;

  return sendTextMessage(to, message);
}

/**
 * Sends the default message when intent is not recognized.
 */
async function sendDefaultMenu(to) {
  const message =
    `No estoy seguro de entender tu mensaje 🤔\n\n` +
    `Puedes elegir una opción:\n\n` +
    `1️⃣ Horarios de atención\n` +
    `2️⃣ Servicios y precios\n` +
    `3️⃣ Ubicación\n` +
    `4️⃣ Agendar una cita\n` +
    `5️⃣ Hablar con alguien del equipo\n\n` +
    `Escribe el *número* de la opción 😊`;

  return sendTextMessage(to, message);
}

// ============================================================
// Appointment Flow (Multi-step conversation)
// ============================================================

/**
 * Starts the appointment booking flow.
 */
async function startAppointmentFlow(to, customerName) {
  setSession(to, {
    step: 'ask_service',
    customerName,
    data: {},
  });

  // Build service list text
  let serviceOptions = '';
  barbershop.services.forEach((s, i) => {
    serviceOptions += `*${i + 1}.* ${s.emoji} ${s.name} — ${formatPrice(s.price)}\n`;
  });

  const message =
    `📅 *Agendar Cita en ${barbershop.name}*\n\n` +
    `¡Perfecto! Vamos a agendar tu cita.\n\n` +
    `Primero, ¿qué servicio deseas?\n\n` +
    `${serviceOptions}\n` +
    `Escribe el *número* del servicio.\n\n` +
    `_Escribe *cancelar* para salir_`;

  return sendTextMessage(to, message);
}

/**
 * Handles the multi-step appointment flow based on current session step.
 */
async function handleAppointmentFlow(to, customerName, text, session) {
  const normalized = normalizeText(text);

  // Allow cancellation at any step
  if (['cancelar', 'salir', 'no'].includes(normalized)) {
    clearSession(to);
    return sendTextMessage(to, '❌ Cita cancelada. Escribe *hola* para volver al menú.');
  }

  switch (session.step) {
    case 'ask_service':
      return handleServiceSelection(to, normalized, session);
    case 'ask_name':
      return handleNameInput(to, text, session);
    case 'ask_date':
      return handleDateInput(to, text, session);
    case 'ask_time':
      return handleTimeInput(to, text, session);
    case 'confirm':
      return handleConfirmation(to, normalized, session);
    default:
      clearSession(to);
      return sendDefaultMenu(to);
  }
}

async function handleServiceSelection(to, text, session) {
  const index = parseInt(text, 10) - 1;

  if (isNaN(index) || index < 0 || index >= barbershop.services.length) {
    return sendTextMessage(to,
      `⚠️ Por favor escribe un número válido (1-${barbershop.services.length}).\n\n_Escribe *cancelar* para salir_`
    );
  }

  const service = barbershop.services[index];
  session.data.service = service.name;
  session.data.servicePrice = service.price;
  session.step = 'ask_name';
  setSession(to, session);

  return sendTextMessage(to,
    `✅ Servicio: *${service.emoji} ${service.name}*\n\n` +
    `¿A nombre de quién agendamos la cita?\n\n` +
    `_Escribe *cancelar* para salir_`
  );
}

async function handleNameInput(to, text, session) {
  if (text.length < 2 || text.length > 50) {
    return sendTextMessage(to, '⚠️ Por favor escribe un nombre válido.');
  }

  session.data.name = text;
  session.step = 'ask_date';
  setSession(to, session);

  return sendTextMessage(to,
    `✅ Nombre: *${text}*\n\n` +
    `¿Para qué fecha? Escribe la fecha en formato:\n` +
    `📅 *DD/MM* (ejemplo: 25/12)\n\n` +
    `_Escribe *cancelar* para salir_`
  );
}

async function handleDateInput(to, text, session) {
  // Simple date validation: DD/MM
  const dateMatch = text.match(/^(\d{1,2})[\/\-](\d{1,2})$/);

  if (!dateMatch) {
    return sendTextMessage(to,
      '⚠️ Formato no válido. Escribe la fecha como *DD/MM* (ejemplo: 25/12)\n\n_Escribe *cancelar* para salir_'
    );
  }

  const day = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return sendTextMessage(to, '⚠️ Fecha no válida. Intenta de nuevo con formato *DD/MM*');
  }

  const year = new Date().getFullYear();
  const dateStr = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;

  session.data.date = dateStr;
  session.step = 'ask_time';
  setSession(to, session);

  return sendTextMessage(to,
    `✅ Fecha: *${dateStr}*\n\n` +
    `¿A qué hora? Escribe la hora en formato:\n` +
    `🕐 *HH:MM* (ejemplo: 10:30, 14:00, 3:00pm)\n\n` +
    `_Escribe *cancelar* para salir_`
  );
}

async function handleTimeInput(to, text, session) {
  // Accept various time formats
  const timeMatch = text.match(/^(\d{1,2})[:\.]?(\d{2})?\s*(am|pm)?$/i);

  if (!timeMatch) {
    return sendTextMessage(to,
      '⚠️ Formato no válido. Escribe la hora como *HH:MM* (ejemplo: 10:30, 2:00pm)\n\n_Escribe *cancelar* para salir_'
    );
  }

  let hour = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? timeMatch[2] : '00';
  const ampm = timeMatch[3]?.toLowerCase();

  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  const timeStr = `${hour.toString().padStart(2, '0')}:${minutes}`;

  session.data.time = timeStr;
  session.step = 'confirm';
  setSession(to, session);

  const d = session.data;
  const message =
    `📋 *Resumen de tu cita:*\n\n` +
    `👤 Nombre: *${d.name}*\n` +
    `✂️ Servicio: *${d.service}*\n` +
    `💰 Precio: *${formatPrice(d.servicePrice)}*\n` +
    `📅 Fecha: *${d.date}*\n` +
    `🕐 Hora: *${timeStr}*\n\n` +
    `¿Confirmas la cita? Escribe *si* o *no*`;

  return sendTextMessage(to, message);
}

async function handleConfirmation(to, text, session) {
  if (['si', 'sí', 'yes', 'confirmar', 'confirmo', 'dale', 'ok', 'listo'].includes(text)) {
    // Save appointment to DynamoDB
    const appointmentData = {
      customerPhone: to,
      customerName: session.data.name,
      service: session.data.service,
      servicePrice: session.data.servicePrice,
      date: session.data.date,
      time: session.data.time,
      status: 'confirmed',
    };

    try {
      await saveAppointment(appointmentData);
    } catch (err) {
      console.error('Error saving appointment:', err);
      // Still confirm to the user even if DB fails
    }

    clearSession(to);

    const message =
      `✅ *¡Cita confirmada!*\n\n` +
      `👤 ${session.data.name}\n` +
      `✂️ ${session.data.service}\n` +
      `📅 ${session.data.date} a las ${session.data.time}\n\n` +
      `Te esperamos en *${barbershop.name}* ${barbershop.emoji}\n` +
      `📍 ${barbershop.location.address}\n\n` +
      `_Si necesitas cancelar o cambiar tu cita, escribe *hola*_`;

    await sendTextMessage(to, message);

    // Notify owner about new appointment
    const ownerPhone = process.env.OWNER_PHONE;
    if (ownerPhone) {
      try {
        await sendTextMessage(ownerPhone,
          `📅 *Nueva cita agendada*\n\n` +
          `👤 ${session.data.name} (${to})\n` +
          `✂️ ${session.data.service}\n` +
          `📅 ${session.data.date} a las ${session.data.time}`
        );
      } catch (err) {
        console.error('Failed to notify owner:', err.message);
      }
    }

    return;
  }

  if (['no', 'cancelar', 'salir'].includes(text)) {
    clearSession(to);
    return sendTextMessage(to, '❌ Cita cancelada. Escribe *hola* para volver al menú.');
  }

  return sendTextMessage(to, '⚠️ Por favor escribe *si* para confirmar o *no* para cancelar.');
}

// ============================================================
// Session Management
// ============================================================

function getSession(phone) {
  const session = sessions[phone];
  if (!session) return null;

  // Check timeout
  if (Date.now() - session.lastActivity > SESSION_TIMEOUT_MS) {
    delete sessions[phone];
    return null;
  }

  return session;
}

function setSession(phone, data) {
  sessions[phone] = {
    ...data,
    lastActivity: Date.now(),
  };
}

function clearSession(phone) {
  delete sessions[phone];
}

// ============================================================
// Helpers
// ============================================================

/**
 * Formats a price in COP.
 */
function formatPrice(price) {
  return `${barbershop.currencySymbol}${price.toLocaleString('es-CO')}`;
}

module.exports = {
  processMessage,
  detectIntent,
  normalizeText,
};
