'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.APPOINTMENTS_TABLE || 'BigBrotherAppointments';

/**
 * Saves a new appointment to DynamoDB.
 * @param {object} appointment - { customerPhone, customerName, service, servicePrice, date, time, status }
 * @returns {object} The saved appointment item
 */
async function saveAppointment(appointment) {
  const timestamp = new Date().toISOString();
  const id = uuidv4();

  const item = {
    PK: `PHONE#${appointment.customerPhone}`,
    SK: `APPT#${timestamp}#${id}`,
    appointmentId: id,
    customerPhone: appointment.customerPhone,
    customerName: appointment.customerName,
    service: appointment.service,
    servicePrice: appointment.servicePrice,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status || 'confirmed',
    createdAt: timestamp,
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  });

  await docClient.send(command);
  console.log('Appointment saved:', JSON.stringify(item));
  return item;
}

/**
 * Gets all appointments for a phone number.
 * @param {string} phone - Customer phone number
 * @returns {Array} List of appointments
 */
async function getAppointmentsByPhone(phone) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `PHONE#${phone}`,
      ':sk': 'APPT#',
    },
    ScanIndexForward: false, // Most recent first
  });

  const result = await docClient.send(command);
  return result.Items || [];
}

module.exports = {
  saveAppointment,
  getAppointmentsByPhone,
};
