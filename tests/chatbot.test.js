'use strict';

/**
 * Simple test for the chatbot intent detection.
 * Run with: node tests/chatbot.test.js
 */

const { detectIntent, normalizeText } = require('../src/services/chatbot');

let passed = 0;
let failed = 0;

function test(description, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.log(`  ❌ ${description} — Expected: "${expected}", Got: "${actual}"`);
    failed++;
  }
}

console.log('\n🧪 Testing Intent Detection\n');

// Greetings
console.log('--- Greetings ---');
test('hola → greeting', detectIntent('hola'), 'greeting');
test('Buenas tardes → greeting', detectIntent('Buenas tardes'), 'greeting');
test('Buenos días → greeting', detectIntent('Buenos días'), 'greeting');
test('Hey → greeting', detectIntent('Hey'), 'greeting');
test('Holi → greeting', detectIntent('Holi'), 'greeting');

// Menu numbers
console.log('\n--- Menu Numbers ---');
test('1 → hours', detectIntent('1'), 'hours');
test('2 → services', detectIntent('2'), 'services');
test('3 → location', detectIntent('3'), 'location');
test('4 → appointment', detectIntent('4'), 'appointment');
test('5 → human', detectIntent('5'), 'human');

// Hours
console.log('\n--- Hours ---');
test('horarios → hours', detectIntent('horarios'), 'hours');
test('A qué hora abren → hours', detectIntent('A qué hora abren'), 'hours');
test('Cuándo atienden → hours', detectIntent('Cuándo atienden'), 'hours');

// Services
console.log('\n--- Services ---');
test('precios → services', detectIntent('precios'), 'services');
test('Cuánto cuesta un corte → services', detectIntent('Cuánto cuesta un corte'), 'services');
test('servicios → services', detectIntent('servicios'), 'services');
test('Cuánto cobran → services', detectIntent('Cuánto cobran'), 'services');

// Location
console.log('\n--- Location ---');
test('ubicación → location', detectIntent('ubicación'), 'location');
test('Dónde quedan → location', detectIntent('Dónde quedan'), 'location');
test('dirección → location', detectIntent('dirección'), 'location');
test('Cómo llego → location', detectIntent('Cómo llego'), 'location');

// Appointment
console.log('\n--- Appointment ---');
test('agendar cita → appointment', detectIntent('agendar cita'), 'appointment');
test('reservar → appointment', detectIntent('reservar'), 'appointment');
test('quiero un turno → appointment', detectIntent('quiero un turno'), 'appointment');

// Human
console.log('\n--- Human ---');
test('hablar con alguien → human', detectIntent('hablar con alguien'), 'human');
test('necesito ayuda → human', detectIntent('necesito ayuda'), 'human');
test('quiero hablar con una persona → human', detectIntent('quiero hablar con una persona'), 'human');

// Thanks
console.log('\n--- Thanks ---');
test('gracias → thanks', detectIntent('gracias'), 'thanks');
test('perfecto → thanks', detectIntent('perfecto'), 'thanks');
test('chevere → thanks', detectIntent('chevere'), 'thanks');

// Cancel
console.log('\n--- Cancel ---');
test('cancelar → cancel', detectIntent('cancelar'), 'cancel');
test('salir → cancel', detectIntent('salir'), 'cancel');

// Unknown
console.log('\n--- Unknown ---');
test('asdfgh → unknown', detectIntent('asdfgh'), 'unknown');
test('xyz123 → unknown', detectIntent('xyz123'), 'unknown');

// Normalize text
console.log('\n--- Normalize Text ---');
test('removes accents', normalizeText('Ubicación'), 'ubicacion');
test('lowercase', normalizeText('HOLA'), 'hola');
test('trims', normalizeText('  hola  '), 'hola');

// Summary
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
