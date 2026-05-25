'use strict';

const https = require('https');

const GRAPH_API_VERSION = 'v21.0';

/**
 * WhatsApp Cloud API Service
 * 
 * IMPORTANT: This service is used to RESPOND to messages from customers.
 * Responding within the 24-hour window is FREE (service conversations).
 * You only pay if YOU initiate a conversation first (marketing).
 * 
 * For a barbershop receiving ~200-500 messages/month, cost = $0.
 * See: https://developers.facebook.com/docs/whatsapp/pricing
 */

/**
 * Sends a text message via WhatsApp Cloud API.
 * @param {string} to - Recipient phone number (e.g., '573001234567')
 * @param {string} text - Message text
 */
async function sendTextMessage(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: true, body: text },
  };

  return sendRequest(payload);
}

/**
 * Sends a location message via WhatsApp Cloud API.
 * @param {string} to - Recipient phone number
 * @param {object} location - { latitude, longitude, name, address }
 */
async function sendLocationMessage(to, location) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'location',
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name || '',
      address: location.address || '',
    },
  };

  return sendRequest(payload);
}

/**
 * Sends an interactive button message via WhatsApp Cloud API.
 * @param {string} to - Recipient phone number
 * @param {string} bodyText - Message body text
 * @param {Array<{id: string, title: string}>} buttons - Up to 3 buttons
 */
async function sendButtonMessage(to, bodyText, buttons) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title },
        })),
      },
    },
  };

  return sendRequest(payload);
}

/**
 * Sends an interactive list message via WhatsApp Cloud API.
 * @param {string} to - Recipient phone number
 * @param {string} bodyText - Message body text
 * @param {string} buttonText - Text for the list button
 * @param {Array<{title: string, rows: Array<{id: string, title: string, description?: string}>}>} sections
 */
async function sendListMessage(to, bodyText, buttonText, sections) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections,
      },
    },
  };

  return sendRequest(payload);
}

/**
 * Marks a message as read (shows blue checkmarks).
 * @param {string} messageId - The message ID to mark as read
 */
async function markAsRead(messageId) {
  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };

  return sendRequest(payload);
}

/**
 * Makes the actual HTTPS request to the WhatsApp Cloud API.
 * Uses native Node.js https module to avoid extra dependencies.
 */
function sendRequest(payload) {
  return new Promise((resolve, reject) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
      console.error('Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
      return reject(new Error('Missing WhatsApp API credentials'));
    }

    const data = JSON.stringify(payload);

    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('WhatsApp API response:', JSON.stringify(parsed));
            resolve(parsed);
          } else {
            console.error('WhatsApp API error:', res.statusCode, JSON.stringify(parsed));
            reject(new Error(`WhatsApp API error: ${res.statusCode} - ${body}`));
          }
        } catch (parseError) {
          console.error('Failed to parse WhatsApp API response:', body);
          reject(parseError);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

module.exports = {
  sendTextMessage,
  sendLocationMessage,
  sendButtonMessage,
  sendListMessage,
  markAsRead,
};
