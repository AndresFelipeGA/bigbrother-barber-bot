'use strict';

const { processMessage } = require('../services/chatbot');

/**
 * Lambda handler for WhatsApp webhook.
 * Handles both GET (verification) and POST (incoming messages).
 */
exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));

  const method = event.httpMethod || event.requestContext?.http?.method;

  try {
    // ---- GET: Webhook Verification ----
    if (method === 'GET') {
      return handleVerification(event);
    }

    // ---- POST: Incoming Message ----
    if (method === 'POST') {
      return await handleIncomingMessage(event);
    }

    return response(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return response(500, { error: 'Internal server error' });
  }
};

/**
 * Handles the GET verification challenge from Meta.
 * Meta sends: hub.mode, hub.verify_token, hub.challenge
 */
function handleVerification(event) {
  const params = event.queryStringParameters || {};
  const mode = params['hub.mode'];
  const token = params['hub.verify_token'];
  const challenge = params['hub.challenge'];

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: challenge,
    };
  }

  console.warn('Webhook verification failed. Token mismatch.');
  return response(403, { error: 'Verification failed' });
}

/**
 * Handles incoming POST messages from WhatsApp Cloud API.
 * Extracts the message and passes it to the chatbot service.
 */
async function handleIncomingMessage(event) {
  const body = JSON.parse(event.body || '{}');

  // Meta always sends this structure
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // Only process messages (not status updates)
  if (!value?.messages || value.messages.length === 0) {
    console.log('No messages in payload (likely a status update). Ignoring.');
    return response(200, { status: 'ok' });
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
  return response(200, { status: 'ok' });
}

/**
 * Helper to build API Gateway response.
 */
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
