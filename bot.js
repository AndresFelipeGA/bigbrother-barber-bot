'use strict';

/**
 * Big Brother Barber Shop - WhatsApp Bot (Baileys)
 * 
 * Main entry point. Connects to WhatsApp via Baileys,
 * listens for incoming messages, and routes them to the chatbot service.
 * 
 * Usage:
 *   node bot.js
 * 
 * First run: Scan the QR code with your WhatsApp app.
 * Subsequent runs: Session is restored automatically.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { processMessage } = require('./src/services/chatbot');
const { setSock, fromJid, markAsRead } = require('./src/services/whatsapp-baileys');

// Session storage directory
const AUTH_DIR = './auth_session';

// Bot's own JID (set after connection)
let botJid = null;

// Track if we've completed initial sync (to avoid processing old messages)
let initialSyncDone = false;

/**
 * Starts the WhatsApp bot connection.
 */
async function startBot() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  💈 Big Brother Barber Shop - WhatsApp Bot  ║');
  console.log('║  Powered by Baileys                      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // Load or create auth session
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  // Get latest Baileys version info
  const { version } = await fetchLatestBaileysVersion();
  console.log(`[Bot] Using WA version: ${version.join('.')}`);

  // Create the socket connection
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true, // Shows QR code in terminal for scanning
    logger: pino({ level: 'silent' }), // Suppress verbose Baileys logs
    browser: ['Big Brother Bot', 'Chrome', '120.0.0'], // Browser identification
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 30000,
    markOnlineOnConnect: false, // Don't show as "online" constantly
  });

  // Inject socket into the WhatsApp service layer
  setSock(sock);

  // ---- Event: Connection Update ----
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Escanea el código QR con tu WhatsApp:');
      console.log('   Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo\n');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[Bot] Connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        // Wait a bit before reconnecting
        setTimeout(() => startBot(), 5000);
      } else {
        console.log('[Bot] Logged out. Delete the auth_session folder and restart to re-authenticate.');
      }
    }

    if (connection === 'open') {
      botJid = sock.user?.id;
      console.log(`\n✅ [Bot] Connected successfully!`);
      console.log(`   📞 Bot number: ${botJid}`);
      console.log(`   🕐 Time: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
      console.log(`   💈 Ready to receive messages!\n`);

      // Wait a few seconds for initial message sync to complete
      setTimeout(() => {
        initialSyncDone = true;
        console.log('[Bot] Initial sync complete. Now processing new messages.');
      }, 5000);
    }
  });

  // ---- Event: Credentials Update ----
  sock.ev.on('creds.update', saveCreds);

  // ---- Event: Incoming Messages ----
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Only process new messages (not history sync)
    if (type !== 'notify') return;

    // Don't process messages during initial sync
    if (!initialSyncDone) return;

    for (const msg of messages) {
      try {
        await handleMessage(msg);
      } catch (err) {
        console.error(`[Bot] Error handling message:`, err.message);
      }
    }
  });

  return sock;
}

/**
 * Handles a single incoming message.
 * Extracts text, determines if it should be processed, and routes to chatbot.
 */
async function handleMessage(msg) {
  // Skip if no message content
  if (!msg.message) return;

  // Skip status broadcasts
  if (msg.key.remoteJid === 'status@broadcast') return;

  // Skip group messages (only handle private chats)
  if (msg.key.remoteJid.endsWith('@g.us')) return;

  // Skip messages sent by the bot itself
  if (msg.key.fromMe) return;

  // Extract the sender's phone number
  const from = fromJid(msg.key.remoteJid);
  const pushName = msg.pushName || 'Cliente';

  // Extract text content from various message types
  let messageText = '';
  const messageContent = msg.message;

  if (messageContent.conversation) {
    messageText = messageContent.conversation;
  } else if (messageContent.extendedTextMessage?.text) {
    messageText = messageContent.extendedTextMessage.text;
  } else if (messageContent.buttonsResponseMessage?.selectedButtonId) {
    messageText = messageContent.buttonsResponseMessage.selectedButtonId;
  } else if (messageContent.listResponseMessage?.singleSelectReply?.selectedRowId) {
    messageText = messageContent.listResponseMessage.singleSelectReply.selectedRowId;
  } else if (messageContent.templateButtonReplyMessage?.selectedId) {
    messageText = messageContent.templateButtonReplyMessage.selectedId;
  } else if (messageContent.imageMessage || messageContent.videoMessage || messageContent.audioMessage) {
    // Media messages - respond with a helpful message
    messageText = '';
  } else {
    // Unknown message type
    messageText = '';
  }

  // Skip empty messages
  if (!messageText.trim()) {
    // If it's a media message, send a helpful response
    if (messageContent.imageMessage || messageContent.videoMessage || messageContent.audioMessage || messageContent.stickerMessage) {
      const { sendTextMessage } = require('./src/services/whatsapp-baileys');
      await sendTextMessage(from, 
        '📷 ¡Gracias por tu mensaje! Por ahora solo puedo procesar texto.\n\n' +
        'Escribe *hola* para ver el menú de opciones 😊'
      );
      return;
    }
    return;
  }

  console.log(`\n📩 [${new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })}] Message from ${from} (${pushName}): "${messageText}"`);

  // Mark message as read (blue checkmarks)
  await markAsRead(msg.key.id, msg.key.remoteJid);

  // Send "typing" indicator
  try {
    await require('./src/services/whatsapp-baileys').getSock()?.presenceSubscribe(msg.key.remoteJid);
    await require('./src/services/whatsapp-baileys').getSock()?.sendPresenceUpdate('composing', msg.key.remoteJid);
  } catch (e) {
    // Ignore presence errors
  }

  // Process the message through the chatbot
  await processMessage({
    from,
    customerName: pushName,
    messageText: messageText.trim(),
    messageType: 'text',
  });

  // Stop "typing" indicator
  try {
    await require('./src/services/whatsapp-baileys').getSock()?.sendPresenceUpdate('paused', msg.key.remoteJid);
  } catch (e) {
    // Ignore
  }
}

// ---- Start the bot ----
startBot().catch(err => {
  console.error('[Bot] Fatal error:', err);
  process.exit(1);
});

// ---- Graceful shutdown ----
process.on('SIGINT', () => {
  console.log('\n[Bot] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Bot] Received SIGTERM. Shutting down...');
  process.exit(0);
});
