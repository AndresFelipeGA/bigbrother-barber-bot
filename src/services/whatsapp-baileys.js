'use strict';

/**
 * WhatsApp Service - Baileys Implementation
 * 
 * Drop-in replacement for whatsapp.js (Meta Cloud API).
 * Exposes the same interface: sendTextMessage, sendLocationMessage, etc.
 * 
 * The socket is injected via setSock() from bot.js after connection.
 */

let sock = null;

/**
 * Sets the Baileys socket instance. Called from bot.js after connection.
 * @param {object} socket - The Baileys WASocket instance
 */
function setSock(socket) {
  sock = socket;
}

/**
 * Gets the current socket instance.
 */
function getSock() {
  return sock;
}

/**
 * Formats a phone number to WhatsApp JID format.
 * Baileys uses: 573001234567@s.whatsapp.net
 * @param {string} phone - Phone number (e.g., '573001234567' or '+573001234567')
 * @returns {string} JID format
 */
function toJid(phone) {
  // Remove + prefix if present
  const cleaned = phone.replace(/^\+/, '').replace(/\D/g, '');
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Extracts phone number from a JID.
 * @param {string} jid - WhatsApp JID (e.g., '573001234567@s.whatsapp.net')
 * @returns {string} Phone number
 */
function fromJid(jid) {
  return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@.*$/, '');
}

/**
 * Adds a human-like delay before sending (1-3 seconds).
 * Helps avoid detection and makes the bot feel more natural.
 */
function humanDelay() {
  const delay = 1000 + Math.random() * 2000; // 1-3 seconds
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Sends a text message via Baileys.
 * @param {string} to - Recipient phone number (e.g., '573001234567')
 * @param {string} text - Message text
 */
async function sendTextMessage(to, text) {
  if (!sock) {
    console.error('Baileys socket not initialized');
    throw new Error('WhatsApp not connected');
  }

  await humanDelay();

  const jid = toJid(to);
  console.log(`[Baileys] Sending text to ${to}: "${text.substring(0, 80)}..."`);

  return sock.sendMessage(jid, { text });
}

/**
 * Sends a location message via Baileys.
 * @param {string} to - Recipient phone number
 * @param {object} location - { latitude, longitude, name, address }
 */
async function sendLocationMessage(to, location) {
  if (!sock) {
    throw new Error('WhatsApp not connected');
  }

  await humanDelay();

  const jid = toJid(to);
  console.log(`[Baileys] Sending location to ${to}`);

  return sock.sendMessage(jid, {
    location: {
      degreesLatitude: location.latitude,
      degreesLongitude: location.longitude,
      name: location.name || '',
      address: location.address || '',
    },
  });
}

/**
 * Sends a button message via Baileys.
 * Note: Baileys button support varies by WhatsApp version.
 * Falls back to numbered text list if buttons aren't supported.
 * 
 * @param {string} to - Recipient phone number
 * @param {string} bodyText - Message body text
 * @param {Array<{id: string, title: string}>} buttons - Up to 3 buttons
 */
async function sendButtonMessage(to, bodyText, buttons) {
  if (!sock) {
    throw new Error('WhatsApp not connected');
  }

  await humanDelay();

  // Baileys buttons may not work on all WhatsApp versions
  // Fall back to text-based menu
  let text = bodyText + '\n';
  buttons.forEach((btn, i) => {
    text += `\n${i + 1}. ${btn.title}`;
  });

  const jid = toJid(to);
  console.log(`[Baileys] Sending button message to ${to}`);

  return sock.sendMessage(jid, { text });
}

/**
 * Sends a list message via Baileys.
 * Falls back to text-based list since interactive lists have limited support.
 * 
 * @param {string} to - Recipient phone number
 * @param {string} bodyText - Message body text
 * @param {string} buttonText - Text for the list button
 * @param {Array<{title: string, rows: Array<{id: string, title: string, description?: string}>}>} sections
 */
async function sendListMessage(to, bodyText, buttonText, sections) {
  if (!sock) {
    throw new Error('WhatsApp not connected');
  }

  await humanDelay();

  // Convert list to text format for maximum compatibility
  let text = bodyText + '\n';
  for (const section of sections) {
    if (section.title) text += `\n*${section.title}*`;
    for (const row of section.rows) {
      text += `\n• ${row.title}`;
      if (row.description) text += ` - ${row.description}`;
    }
  }

  const jid = toJid(to);
  console.log(`[Baileys] Sending list message to ${to}`);

  return sock.sendMessage(jid, { text });
}

/**
 * Marks a message as read (shows blue checkmarks).
 * @param {string} messageId - The message key
 * @param {string} remoteJid - The chat JID
 */
async function markAsRead(messageId, remoteJid) {
  if (!sock) return;

  try {
    await sock.readMessages([{
      remoteJid,
      id: messageId,
    }]);
  } catch (err) {
    console.error('[Baileys] Failed to mark as read:', err.message);
  }
}

module.exports = {
  setSock,
  getSock,
  toJid,
  fromJid,
  sendTextMessage,
  sendLocationMessage,
  sendButtonMessage,
  sendListMessage,
  markAsRead,
};
