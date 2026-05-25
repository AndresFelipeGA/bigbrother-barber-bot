'use strict';

const { processMessage } = require('../src/services/chatbot');

/**
 * Vercel Serverless Function - WhatsApp Webhook
 * Handles both GET (verification) and POST (incoming messages).
 * 
 * URL: https://your-project.vercel.app/webhook
 */
module.exports = async function handler(req, res) {
  console.log(`[Webhook] ${req.method} request received`);

  try {
    // ---- GET: Webhook Verification ----
    if (req.method === 'GET') {
      return handleVerification(req, res);
    }

    // ---- POST: Incoming Message ----
    if (req.method === 'POST') {
      return await handleIncomingMessage(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handles the GET verification challenge from Meta.
 * Meta sends: hub.mode, hub.verify_token, hub.challenge
 */
function handleVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  console.warn('Webhook verification failed. Token mismatch.');
  return res.status(403).json({ error: 'Verification failed' });
}

/**
 * Handles incoming POST messages from WhatsApp Cloud API.
 * Extracts the message and passes it to the chatbot service.
 */
async function handleIncomingMessage(req, res) {
  const body = req.body || {};

  // Meta always sends this structure
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // Only process messages (not status updates)
  if (!value?.messages || value.messages.length === 0) {
    console.log('No messages in payload (likely a status update). Ignoring.');
    return res.status(200).json({ status: 'ok' });
  }

  const message = value.messages[0];
  const contact = value.contacts?.[0];
  const from = message.from; // Phone number of sender
  const customerName = contact?.profile?.name || 'Cliente';

  console.log(`Message from ${from} (${customerName}):`, JSON.stringify(message));

  // Extract text content based on message type
  let messageText = '';
  if (message.type === 'text') {
    messageText = message.text?.body || '';
  } else if (message.type === 'interactive') {
    // Button or list reply
    messageText = message.interactive?.button_reply?.title
      || message.interactive?.list_reply?.title
      || message.interactive?.list_reply?.id
      || '';
  } else {
    messageText = '';
  }

  // Process the message through the chatbot
  await processMessage({
    from,
    customerName,
    messageText: messageText.trim(),
    messageType: message.type,
    rawMessage: message,
  });

  // Always return 200 to Meta (they retry on errors)
  return res.status(200).json({ status: 'ok' });
}
