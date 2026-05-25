'use strict';

/**
 * Formats a phone number for display.
 * @param {string} phone - Phone number (e.g., '573001234567')
 * @returns {string} Formatted phone (e.g., '+57 300 123 4567')
 */
function formatPhone(phone) {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('57')) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  return `+${clean}`;
}

/**
 * Gets the current date/time in Colombia timezone.
 * @returns {Date} Current date in America/Bogota
 */
function getColombiaTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
}

/**
 * Checks if the barbershop is currently open based on schedule.
 * @param {object} schedule - Schedule object from barbershop.json
 * @returns {boolean} True if currently open
 */
function isCurrentlyOpen(schedule) {
  const now = getColombiaTime();
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const today = days[now.getDay()];
  const hours = schedule[today];

  if (!hours || hours === 'Cerrado') return false;

  // Parse "9:00 AM - 8:00 PM" format
  const match = hours.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return false;

  let openHour = parseInt(match[1], 10);
  const openMin = parseInt(match[2], 10);
  const openAmPm = match[3].toUpperCase();
  let closeHour = parseInt(match[4], 10);
  const closeMin = parseInt(match[5], 10);
  const closeAmPm = match[6].toUpperCase();

  if (openAmPm === 'PM' && openHour !== 12) openHour += 12;
  if (openAmPm === 'AM' && openHour === 12) openHour = 0;
  if (closeAmPm === 'PM' && closeHour !== 12) closeHour += 12;
  if (closeAmPm === 'AM' && closeHour === 12) closeHour = 0;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openHour * 60 + openMin;
  const closeMinutes = closeHour * 60 + closeMin;

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}

module.exports = {
  formatPhone,
  getColombiaTime,
  isCurrentlyOpen,
};
