const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for charging processes
// In production, this should be replaced with a proper database
const chargingProcesses = [];
let processIdCounter = 1;

// Current state of each device
const deviceStates = {};

// MQTT Configuration
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const MQTT_DEVICES = process.env.MQTT_DEVICES ? process.env.MQTT_DEVICES.split(',').map(d => d.trim()) : [];
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';

console.log('Starting backend server...');
console.log('MQTT Broker:', MQTT_BROKER_URL);
console.log('Configured devices:', MQTT_DEVICES);

// MQTT Client setup
const mqttOptions = {
  clean: true,
  connectTimeout: 4000,
};

if (MQTT_USERNAME) {
  mqttOptions.username = MQTT_USERNAME;
}

if (MQTT_PASSWORD) {
  mqttOptions.password = MQTT_PASSWORD;
}

const mqttClient = mqtt.connect(MQTT_BROKER_URL, mqttOptions);

// Subscribe to topics for all configured devices
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  
  MQTT_DEVICES.forEach(deviceId => {
    // Subscribe to power on/off topic
    const powerTopic = `${deviceId}/relay/0`;
    mqttClient.subscribe(powerTopic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${powerTopic}:`, err);
      } else {
        console.log(`Subscribed to ${powerTopic}`);
      }
    });
    
    // Subscribe to power consumption topic
    const consumptionTopic = `${deviceId}/relay/0/power`;
    mqttClient.subscribe(consumptionTopic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${consumptionTopic}:`, err);
      } else {
        console.log(`Subscribed to ${consumptionTopic}`);
      }
    });
    
    // Initialize device state
    deviceStates[deviceId] = {
      isOn: false,
      power: 0,
      currentProcessId: null
    };
  });
});

mqttClient.on('error', (error) => {
  console.error('MQTT connection error:', error);
});

mqttClient.on('message', (topic, message) => {
  const timestamp = new Date().toISOString();
  const messageStr = message.toString();
  
  console.log(`Received message on ${topic}: ${messageStr}`);
  
  // Parse topic to extract device ID
  const topicParts = topic.split('/');
  const deviceId = topicParts[0];
  
  if (!deviceStates[deviceId]) {
    console.warn(`Received message for unknown device: ${deviceId}`);
    return;
  }
  
  // Handle power on/off messages
  if (topic.endsWith('/relay/0')) {
    const isOn = messageStr.toLowerCase() === 'on' || messageStr === '1' || messageStr === 'true';
    
    if (isOn && !deviceStates[deviceId].isOn) {
      // Start new charging process
      const processId = processIdCounter++;
      const newProcess = {
        id: processId,
        deviceId: deviceId,
        startTime: timestamp,
        endTime: null,
        events: [
          {
            timestamp: timestamp,
            type: 'power_on',
            value: true
          }
        ]
      };
      
      chargingProcesses.push(newProcess);
      deviceStates[deviceId].currentProcessId = processId;
      deviceStates[deviceId].isOn = true;
      
      console.log(`Started charging process ${processId} for device ${deviceId}`);
    } else if (!isOn && deviceStates[deviceId].isOn) {
      // End current charging process
      const processId = deviceStates[deviceId].currentProcessId;
      const process = chargingProcesses.find(p => p.id === processId);
      
      if (process) {
        process.endTime = timestamp;
        process.events.push({
          timestamp: timestamp,
          type: 'power_off',
          value: false
        });
        
        console.log(`Ended charging process ${processId} for device ${deviceId}`);
      }
      
      deviceStates[deviceId].isOn = false;
      deviceStates[deviceId].currentProcessId = null;
    }
  }
  
  // Handle power consumption messages
  if (topic.endsWith('/power')) {
    const power = parseFloat(messageStr);
    
    if (!isNaN(power)) {
      deviceStates[deviceId].power = power;
      
      // Add to current process if one is active
      const processId = deviceStates[deviceId].currentProcessId;
      if (processId !== null) {
        const process = chargingProcesses.find(p => p.id === processId);
        if (process) {
          process.events.push({
            timestamp: timestamp,
            type: 'power_consumption',
            value: power
          });
        }
      }
    }
  }
});

// API Routes

// Get all charging processes
app.get('/api/processes', (req, res) => {
  res.json(chargingProcesses);
});

// Get charging processes for a specific device
app.get('/api/processes/device/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const deviceProcesses = chargingProcesses.filter(p => p.deviceId === deviceId);
  res.json(deviceProcesses);
});

// Get a specific charging process
app.get('/api/processes/:id', (req, res) => {
  const processId = parseInt(req.params.id);
  const process = chargingProcesses.find(p => p.id === processId);
  
  if (process) {
    res.json(process);
  } else {
    res.status(404).json({ error: 'Process not found' });
  }
});

// Get current device states
app.get('/api/devices', (req, res) => {
  const devices = Object.entries(deviceStates).map(([id, state]) => ({
    id,
    isOn: state.isOn,
    power: state.power,
    currentProcessId: state.currentProcessId
  }));
  
  res.json(devices);
});

// Get state of a specific device
app.get('/api/devices/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const state = deviceStates[deviceId];
  
  if (state) {
    res.json({
      id: deviceId,
      isOn: state.isOn,
      power: state.power,
      currentProcessId: state.currentProcessId
    });
  } else {
    res.status(404).json({ error: 'Device not found' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mqttConnected: mqttClient.connected,
    devices: MQTT_DEVICES,
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
