const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const dotenv = require('dotenv');
const storage = require('./storage');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Persistent storage for charging processes
// Load existing processes from file
const chargingProcesses = storage.loadProcesses();
let processIdCounter = storage.loadProcessCounter();

// Throttle mechanism for saving power consumption events
let saveTimer = null;
const SAVE_THROTTLE_MS = 5000; // Save at most once every 5 seconds

function scheduleSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    storage.saveProcesses(chargingProcesses);
    saveTimer = null;
  }, SAVE_THROTTLE_MS);
}

// Current state of each device
const deviceStates = {};

// MQTT Configuration
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';

// Parse device configurations
// New format: "Name:topic,Name2:topic2" (e.g., "Office Charger:shellies/shellyplug07")
// Legacy format: "deviceId,deviceId2" (backward compatible)
const parseDeviceConfig = (configString) => {
  if (!configString) return [];
  
  return configString.split(',').map(item => {
    const trimmed = item.trim();
    if (trimmed.includes(':')) {
      // New format: name:topic
      const [name, topic] = trimmed.split(':').map(s => s.trim());
      return { name, topic, id: topic.replace(/\//g, '_') };
    } else {
      // Legacy format: just device ID (topic = deviceId)
      return { name: trimmed, topic: trimmed, id: trimmed };
    }
  });
};

const MQTT_DEVICES = parseDeviceConfig(process.env.MQTT_DEVICES);

console.log('Starting backend server...');
console.log('MQTT Broker:', MQTT_BROKER_URL);
console.log('Configured devices:', MQTT_DEVICES.map(d => `${d.name} (${d.topic})`).join(', '));

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
  
  MQTT_DEVICES.forEach(device => {
    // Subscribe to power on/off topic
    const powerTopic = `${device.topic}/relay/0`;
    mqttClient.subscribe(powerTopic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${powerTopic}:`, err);
      } else {
        console.log(`Subscribed to ${powerTopic} for device "${device.name}"`);
      }
    });
    
    // Subscribe to power consumption topic
    const consumptionTopic = `${device.topic}/relay/0/power`;
    mqttClient.subscribe(consumptionTopic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${consumptionTopic}:`, err);
      } else {
        console.log(`Subscribed to ${consumptionTopic} for device "${device.name}"`);
      }
    });
    
    // Initialize device state with unique ID and name
    deviceStates[device.id] = {
      name: device.name,
      topic: device.topic,
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
  
  // Find device by matching topic prefix
  let deviceId = null;
  let deviceConfig = null;
  
  for (const [id, state] of Object.entries(deviceStates)) {
    if (topic.startsWith(state.topic + '/')) {
      deviceId = id;
      deviceConfig = state;
      break;
    }
  }
  
  if (!deviceId || !deviceConfig) {
    console.warn(`Received message for unknown device on topic: ${topic}`);
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
        deviceName: deviceConfig.name,
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
      
      // Persist to storage
      storage.saveProcesses(chargingProcesses);
      storage.saveProcessCounter(processIdCounter);
      
      console.log(`Started charging process ${processId} for device "${deviceConfig.name}"`);
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
        
        // Persist to storage
        storage.saveProcesses(chargingProcesses);
        
        console.log(`Ended charging process ${processId} for device "${deviceConfig.name}"`);
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
          
          // Schedule a throttled save
          scheduleSave();
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
    name: state.name,
    topic: state.topic,
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
      name: state.name,
      topic: state.topic,
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

// Graceful shutdown handler to save data before exit
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}, saving data and shutting down gracefully...`);
  
  // Clear any pending save timer and save immediately
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  storage.saveProcesses(chargingProcesses);
  storage.saveProcessCounter(processIdCounter);
  
  // Close MQTT connection with timeout
  if (mqttClient && mqttClient.connected) {
    const shutdownTimeout = setTimeout(() => {
      console.log('MQTT disconnect timeout, forcing exit');
      process.exit(0);
    }, 5000);
    
    mqttClient.end(false, (err) => {
      clearTimeout(shutdownTimeout);
      if (err) {
        console.error('Error disconnecting MQTT client:', err);
      } else {
        console.log('MQTT client disconnected');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
