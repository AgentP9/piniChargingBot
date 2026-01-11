const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const dotenv = require('dotenv');
const storage = require('./storage');
const patternAnalyzer = require('./patternAnalyzer');

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

// Pattern analysis storage
let chargingPatterns = patternAnalyzer.loadPatterns();

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

// Function to run pattern analysis
function runPatternAnalysis() {
  console.log('Running pattern analysis...');
  chargingPatterns = patternAnalyzer.analyzePatterns(chargingProcesses);
  patternAnalyzer.savePatterns(chargingPatterns);
  console.log(`Pattern analysis complete. Found ${chargingPatterns.length} patterns.`);
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
        
        // Run pattern analysis after completing a process
        // This helps identify device patterns immediately
        setTimeout(() => runPatternAnalysis(), 1000);
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

// Get active (incomplete) processes for a specific device
app.get('/api/devices/:deviceId/active-processes', (req, res) => {
  const { deviceId } = req.params;
  const activeProcesses = chargingProcesses.filter(p => p.deviceId === deviceId && p.endTime === null);
  res.json(activeProcesses);
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

// Delete a charging process
app.delete('/api/processes/:id', (req, res) => {
  const processId = parseInt(req.params.id);
  
  // Validate that the ID is a valid number
  if (isNaN(processId)) {
    return res.status(400).json({ error: 'Invalid process ID' });
  }
  
  const processIndex = chargingProcesses.findIndex(p => p.id === processId);
  
  if (processIndex === -1) {
    return res.status(404).json({ error: 'Process not found' });
  }
  
  // Remove the process from the array
  chargingProcesses.splice(processIndex, 1);
  
  // Persist the change to storage
  storage.saveProcesses(chargingProcesses);
  
  console.log(`Deleted charging process ${processId}`);
  res.json({ success: true, message: 'Process deleted successfully' });
});

// Mark a charging process as complete (manually set endTime)
app.put('/api/processes/:id/complete', (req, res) => {
  const processId = parseInt(req.params.id);
  
  // Validate that the ID is a valid number
  if (isNaN(processId)) {
    return res.status(400).json({ error: 'Invalid process ID' });
  }
  
  const process = chargingProcesses.find(p => p.id === processId);
  
  if (!process) {
    return res.status(404).json({ error: 'Process not found' });
  }
  
  // Check if process is already completed
  if (process.endTime !== null) {
    return res.status(400).json({ error: 'Process is already completed' });
  }
  
  // Mark the process as complete with current timestamp
  const timestamp = new Date().toISOString();
  process.endTime = timestamp;
  process.events.push({
    timestamp: timestamp,
    type: 'manual_completion',
    value: false
  });
  
  // Clear current process reference if this device is tracking it
  const deviceState = Object.values(deviceStates).find(
    state => state.currentProcessId === processId
  );
  if (deviceState) {
    deviceState.isOn = false;
    deviceState.currentProcessId = null;
  }
  
  // Persist the change to storage
  storage.saveProcesses(chargingProcesses);
  
  console.log(`Manually completed charging process ${processId}`);
  
  // Run pattern analysis after manual completion
  setTimeout(() => runPatternAnalysis(), 1000);
  
  res.json({ success: true, message: 'Process marked as complete', process });
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

// Pattern Analysis Endpoints

// Get all identified charging patterns
app.get('/api/patterns', (req, res) => {
  res.json(chargingPatterns);
});

// Get patterns for a specific device
app.get('/api/patterns/device/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const devicePatterns = chargingPatterns.filter(p => p.deviceId === deviceId);
  res.json(devicePatterns);
});

// Trigger pattern analysis manually
app.post('/api/patterns/analyze', (req, res) => {
  try {
    console.log('Manual pattern analysis triggered via API');
    runPatternAnalysis();
    res.json({ 
      success: true, 
      message: 'Pattern analysis completed',
      patternsFound: chargingPatterns.length,
      totalProcesses: chargingProcesses.length,
      completedProcesses: chargingProcesses.filter(p => p.endTime).length
    });
  } catch (error) {
    console.error('Error running pattern analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to run pattern analysis' 
    });
  }
});

// Get pattern match for a specific process
app.get('/api/processes/:id/pattern', (req, res) => {
  const processId = parseInt(req.params.id);
  
  // Validate that the ID is a valid number
  if (isNaN(processId)) {
    return res.status(400).json({ error: 'Invalid process ID' });
  }
  
  const process = chargingProcesses.find(p => p.id === processId);
  
  if (!process) {
    return res.status(404).json({ error: 'Process not found' });
  }
  
  const match = patternAnalyzer.findMatchingPattern(process, chargingPatterns);
  
  if (match) {
    res.json({
      processId: processId,
      matchFound: true,
      pattern: match.pattern,
      similarity: match.similarity
    });
  } else {
    res.json({
      processId: processId,
      matchFound: false,
      message: 'No matching pattern found'
    });
  }
});

// Diagnostic endpoint to help troubleshoot pattern recognition
app.get('/api/patterns/debug', (req, res) => {
  const completedProcesses = chargingProcesses.filter(p => p.endTime);
  const processesWithPowerData = completedProcesses.filter(p => 
    p.events.some(e => e.type === 'power_consumption')
  );
  
  const processDetails = processesWithPowerData.map(p => {
    const powerEvents = p.events.filter(e => e.type === 'power_consumption' && e.value > 0);
    const profile = patternAnalyzer.calculatePowerProfile(p);
    const matchingPattern = chargingPatterns.find(pattern => 
      pattern.processIds && pattern.processIds.includes(p.id)
    );
    
    return {
      id: p.id,
      deviceName: p.deviceName || p.deviceId,
      completed: !!p.endTime,
      powerEventsCount: powerEvents.length,
      hasProfile: profile !== null,
      hasPattern: !!matchingPattern,
      patternId: matchingPattern?.id,
      duration: p.endTime ? (new Date(p.endTime) - new Date(p.startTime)) / 1000 / 60 : null
    };
  });
  
  res.json({
    totalProcesses: chargingProcesses.length,
    completedProcesses: completedProcesses.length,
    processesWithPowerData: processesWithPowerData.length,
    totalPatterns: chargingPatterns.length,
    processDetails: processDetails
  });
});

// Pattern Label Management Endpoints

// Update device label for a pattern
app.put('/api/patterns/:patternId/label', (req, res) => {
  const { patternId } = req.params;
  const { newLabel, shouldRenameAll } = req.body;
  
  if (!newLabel || typeof newLabel !== 'string' || newLabel.trim() === '') {
    return res.status(400).json({ error: 'Invalid label' });
  }
  
  const trimmedLabel = newLabel.trim();
  
  // Try to update the label
  const result = patternAnalyzer.updatePatternLabel(chargingPatterns, patternId, trimmedLabel);
  
  if (!result.success) {
    if (result.shouldMerge) {
      // Label exists, client needs to decide whether to merge
      return res.status(409).json({ 
        error: result.error, 
        shouldMerge: true,
        targetPatternId: result.targetPatternId 
      });
    }
    return res.status(404).json({ error: result.error });
  }
  
  // Save updated patterns
  patternAnalyzer.savePatterns(chargingPatterns);
  
  // If shouldRenameAll is true, update all processes with the old label
  if (shouldRenameAll && result.oldLabel) {
    const pattern = chargingPatterns.find(p => p.id === patternId);
    if (pattern && pattern.processIds) {
      pattern.processIds.forEach(processId => {
        const process = chargingProcesses.find(p => p.id === processId);
        if (process) {
          process.deviceName = trimmedLabel;
        }
      });
      storage.saveProcesses(chargingProcesses);
    }
  }
  
  console.log(`Updated pattern ${patternId} label from "${result.oldLabel}" to "${trimmedLabel}"`);
  
  res.json({ 
    success: true, 
    message: 'Label updated successfully',
    oldLabel: result.oldLabel,
    newLabel: trimmedLabel,
    processesUpdated: shouldRenameAll
  });
});

// Merge two patterns
app.post('/api/patterns/merge', (req, res) => {
  const { sourcePatternId, targetPatternId } = req.body;
  
  if (!sourcePatternId || !targetPatternId) {
    return res.status(400).json({ error: 'Source and target pattern IDs required' });
  }
  
  if (sourcePatternId === targetPatternId) {
    return res.status(400).json({ error: 'Cannot merge a pattern with itself' });
  }
  
  const result = patternAnalyzer.mergePatterns(chargingPatterns, sourcePatternId, targetPatternId);
  
  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }
  
  // Save updated patterns
  patternAnalyzer.savePatterns(chargingPatterns);
  
  // Update all processes from source pattern to use target pattern's device name
  const targetPattern = chargingPatterns.find(p => p.id === targetPatternId);
  if (targetPattern && targetPattern.processIds) {
    targetPattern.processIds.forEach(processId => {
      const process = chargingProcesses.find(p => p.id === processId);
      if (process) {
        process.deviceName = targetPattern.deviceName;
      }
    });
    storage.saveProcesses(chargingProcesses);
  }
  
  console.log(`Merged pattern ${sourcePatternId} into ${targetPatternId}`);
  
  res.json({
    success: true,
    message: 'Patterns merged successfully',
    mergedPattern: result.mergedPattern,
    removedPatternId: result.removedPatternId
  });
});

// Delete a pattern
app.delete('/api/patterns/:patternId', (req, res) => {
  const { patternId } = req.params;
  
  const result = patternAnalyzer.deletePattern(chargingPatterns, patternId);
  
  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }
  
  // Save updated patterns
  patternAnalyzer.savePatterns(chargingPatterns);
  
  // Note: We don't delete the processes, we just remove their pattern association
  // The processes still exist with their original deviceName
  
  console.log(`Deleted pattern ${patternId}`);
  
  res.json({
    success: true,
    message: 'Pattern deleted successfully',
    deletedPattern: result.deletedPattern
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Run initial pattern analysis on startup
  if (chargingProcesses.length > 0) {
    console.log('Running initial pattern analysis...');
    setTimeout(() => runPatternAnalysis(), 2000);
  }
  
  // Schedule periodic pattern analysis (every 1 hour)
  setInterval(() => {
    console.log('Running scheduled pattern analysis...');
    runPatternAnalysis();
  }, 60 * 60 * 1000);
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
