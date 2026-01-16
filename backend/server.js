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
async function runPatternAnalysis() {
  console.log('Running pattern analysis...');
  try {
    chargingPatterns = patternAnalyzer.analyzePatterns(chargingProcesses, chargingPatterns);
    patternAnalyzer.savePatterns(chargingPatterns);
    console.log(`Pattern analysis complete. Found ${chargingPatterns.length} patterns.`);
  } catch (error) {
    console.error('Error during pattern analysis:', error);
  }
}

// Current state of each charger (physical charging device like ShellyPlug)
const chargerStates = {};

// MQTT Configuration
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';

// Parse charger configurations (for physical charging devices like ShellyPlugs)
// New format: "Name:topic,Name2:topic2" (e.g., "Office Charger:shellies/shellyplug07")
// Legacy format: "chargerId,chargerId2" (backward compatible)
const parseChargerConfig = (configString) => {
  if (!configString) return [];
  
  return configString.split(',').map(item => {
    const trimmed = item.trim();
    if (trimmed.includes(':')) {
      // New format: name:topic
      const [name, topic] = trimmed.split(':').map(s => s.trim());
      return { name, topic, id: topic.replace(/\//g, '_') };
    } else {
      // Legacy format: just charger ID (topic = chargerId)
      return { name: trimmed, topic: trimmed, id: trimmed };
    }
  });
};

const MQTT_CHARGERS = parseChargerConfig(process.env.MQTT_DEVICES);

console.log('Starting backend server...');
console.log('MQTT Broker:', MQTT_BROKER_URL);
console.log('Configured chargers:', MQTT_CHARGERS.map(d => `${d.name} (${d.topic})`).join(', '));

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

// Subscribe to topics for all configured chargers
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  
  MQTT_CHARGERS.forEach(charger => {
    // Subscribe to power on/off topic
    const powerTopic = `${charger.topic}/relay/0`;
    mqttClient.subscribe(powerTopic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${powerTopic}:`, err);
      } else {
        console.log(`Subscribed to ${powerTopic} for charger "${charger.name}"`);
      }
    });
    
    // Subscribe to power consumption topic
    const consumptionTopic = `${charger.topic}/relay/0/power`;
    mqttClient.subscribe(consumptionTopic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${consumptionTopic}:`, err);
      } else {
        console.log(`Subscribed to ${consumptionTopic} for charger "${charger.name}"`);
      }
    });
    
    // Initialize charger state with unique ID and name
    chargerStates[charger.id] = {
      name: charger.name,
      topic: charger.topic,
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
  
  // Find charger by matching topic prefix
  let chargerId = null;
  let chargerConfig = null;
  
  for (const [id, state] of Object.entries(chargerStates)) {
    if (topic.startsWith(state.topic + '/')) {
      chargerId = id;
      chargerConfig = state;
      break;
    }
  }
  
  if (!chargerId || !chargerConfig) {
    console.warn(`Received message for unknown charger on topic: ${topic}`);
    return;
  }
  
  // Handle power on/off messages
  if (topic.endsWith('/relay/0')) {
    const isOn = messageStr.toLowerCase() === 'on' || messageStr === '1' || messageStr === 'true';
    
    if (isOn && !chargerStates[chargerId].isOn) {
      // Start new charging process
      const processId = processIdCounter++;
      const newProcess = {
        id: processId,
        deviceId: chargerId, // Backward compatibility: keep old field name
        chargerId: chargerId,
        deviceName: chargerConfig.name, // Backward compatibility: this was the charger name
        chargerName: chargerConfig.name,
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
      chargerStates[chargerId].currentProcessId = processId;
      chargerStates[chargerId].isOn = true;
      
      // Persist to storage
      storage.saveProcesses(chargingProcesses);
      storage.saveProcessCounter(processIdCounter);
      
      console.log(`Started charging process ${processId} on charger "${chargerConfig.name}"`);
    } else if (!isOn && chargerStates[chargerId].isOn) {
      // End current charging process
      const processId = chargerStates[chargerId].currentProcessId;
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
        
        console.log(`Ended charging process ${processId} on charger "${chargerConfig.name}"`);
      }
      
      chargerStates[chargerId].isOn = false;
      chargerStates[chargerId].currentProcessId = null;
    }
  }
  
  // Handle power consumption messages
  if (topic.endsWith('/power')) {
    const power = parseFloat(messageStr);
    
    if (!isNaN(power)) {
      chargerStates[chargerId].power = power;
      
      // Add to current process if one is active
      const processId = chargerStates[chargerId].currentProcessId;
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

// Get charging processes for a specific charger
app.get('/api/processes/charger/:chargerId', (req, res) => {
  const { chargerId } = req.params;
  // Check both fields for backward compatibility
  const chargerProcesses = chargingProcesses.filter(p => 
    p.chargerId === chargerId || p.deviceId === chargerId
  );
  res.json(chargerProcesses);
});

// Backward compatibility: old endpoint name
app.get('/api/processes/device/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  // Check both fields for backward compatibility
  const chargerProcesses = chargingProcesses.filter(p => 
    p.chargerId === deviceId || p.deviceId === deviceId
  );
  res.json(chargerProcesses);
});

// Get active (incomplete) processes for a specific charger
app.get('/api/chargers/:chargerId/active-processes', (req, res) => {
  const { chargerId } = req.params;
  // Check both fields for backward compatibility
  const activeProcesses = chargingProcesses.filter(p => 
    (p.chargerId === chargerId || p.deviceId === chargerId) && p.endTime === null
  );
  res.json(activeProcesses);
});

// Backward compatibility: old endpoint name
app.get('/api/devices/:deviceId/active-processes', (req, res) => {
  const { deviceId } = req.params;
  // Check both fields for backward compatibility
  const activeProcesses = chargingProcesses.filter(p => 
    (p.chargerId === deviceId || p.deviceId === deviceId) && p.endTime === null
  );
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
  
  // Clear current process reference if this charger is tracking it
  const chargerState = Object.values(chargerStates).find(
    state => state.currentProcessId === processId
  );
  if (chargerState) {
    chargerState.isOn = false;
    chargerState.currentProcessId = null;
  }
  
  // Persist the change to storage
  storage.saveProcesses(chargingProcesses);
  
  console.log(`Manually completed charging process ${processId}`);
  
  res.json({ success: true, message: 'Process marked as complete', process });
});

// Update device name for a single process
// This can split a pattern if the process is being renamed differently from its pattern
app.put('/api/processes/:id/device-name', (req, res) => {
  const processId = parseInt(req.params.id);
  const { newDeviceName } = req.body;
  
  // Validate that the ID is a valid number
  if (Number.isNaN(processId) || !Number.isInteger(processId)) {
    return res.status(400).json({ error: 'Invalid process ID' });
  }
  
  if (!newDeviceName || typeof newDeviceName !== 'string' || newDeviceName.trim() === '') {
    return res.status(400).json({ error: 'Invalid device name' });
  }
  
  const process = chargingProcesses.find(p => p.id === processId);
  
  if (!process) {
    return res.status(404).json({ error: 'Process not found' });
  }
  
  const trimmedName = newDeviceName.trim();
  const oldDeviceName = process.deviceName;
  
  // Update the process's device name
  process.deviceName = trimmedName;
  storage.saveProcesses(chargingProcesses);
  
  // Find the pattern that currently contains this process
  const currentPattern = chargingPatterns.find(pattern => 
    pattern.processIds && pattern.processIds.includes(processId)
  );
  
  if (currentPattern) {
    // Remove this process from the current pattern
    currentPattern.processIds = currentPattern.processIds.filter(id => id !== processId);
    currentPattern.count = currentPattern.processIds.length;
    
    // If the pattern is now empty, remove it
    if (currentPattern.count === 0) {
      const patternIndex = chargingPatterns.findIndex(p => p.id === currentPattern.id);
      if (patternIndex !== -1) {
        chargingPatterns.splice(patternIndex, 1);
        console.log(`Removed empty pattern ${currentPattern.id}`);
      }
    }
    
    // Check if there's an existing pattern with the new device name
    const targetPattern = chargingPatterns.find(p => p.deviceName === trimmedName);
    
    if (targetPattern) {
      // Add this process to the existing pattern
      if (!targetPattern.processIds.includes(processId)) {
        targetPattern.processIds.push(processId);
        targetPattern.count = targetPattern.processIds.length;
        console.log(`Added process ${processId} to existing pattern ${targetPattern.id}`);
      }
    } else {
      // Create a new pattern for this process
      const profile = patternAnalyzer.calculatePowerProfile(process);
      const duration = patternAnalyzer.calculateDuration(process);
      
      if (profile && duration) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 11);
        const newPatternId = `pattern_${timestamp}_${random}`;
        
        const newPattern = {
          id: newPatternId,
          deviceId: process.chargerId || process.deviceId,
          chargerId: process.chargerId || process.deviceId,
          chargerName: process.chargerName || process.deviceName || process.chargerId || process.deviceId,
          deviceName: trimmedName,
          count: 1,
          processIds: [processId],
          averageProfile: { ...profile },
          statistics: {
            averageDuration: parseFloat(duration.toFixed(2)),
            minDuration: parseFloat(duration.toFixed(2)),
            maxDuration: parseFloat(duration.toFixed(2)),
            medianDuration: parseFloat(duration.toFixed(2)),
            totalSessions: 1
          },
          firstSeen: process.startTime,
          lastSeen: process.endTime
        };
        
        chargingPatterns.push(newPattern);
        console.log(`Created new pattern ${newPatternId} with device name "${trimmedName}"`);
      }
    }
    
    // Save updated patterns
    patternAnalyzer.savePatterns(chargingPatterns);
  }
  
  console.log(`Updated process ${processId} device name from "${oldDeviceName}" to "${trimmedName}"`);
  
  res.json({
    success: true,
    message: 'Process device name updated',
    processId,
    oldDeviceName,
    newDeviceName: trimmedName
  });
});

// Get current charger states
app.get('/api/chargers', (req, res) => {
  const chargers = Object.entries(chargerStates).map(([id, state]) => ({
    id,
    name: state.name,
    topic: state.topic,
    isOn: state.isOn,
    power: state.power,
    currentProcessId: state.currentProcessId
  }));
  
  res.json(chargers);
});

// Backward compatibility: old endpoint name
app.get('/api/devices', (req, res) => {
  const chargers = Object.entries(chargerStates).map(([id, state]) => ({
    id,
    name: state.name,
    topic: state.topic,
    isOn: state.isOn,
    power: state.power,
    currentProcessId: state.currentProcessId
  }));
  
  res.json(chargers);
});

// Get state of a specific charger
app.get('/api/chargers/:chargerId', (req, res) => {
  const { chargerId } = req.params;
  const state = chargerStates[chargerId];
  
  if (state) {
    res.json({
      id: chargerId,
      name: state.name,
      topic: state.topic,
      isOn: state.isOn,
      power: state.power,
      currentProcessId: state.currentProcessId
    });
  } else {
    res.status(404).json({ error: 'Charger not found' });
  }
});

// Backward compatibility: old endpoint name
app.get('/api/devices/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const state = chargerStates[deviceId];
  
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
    chargers: MQTT_CHARGERS,
    timestamp: new Date().toISOString()
  });
});

// Pattern Analysis Endpoints

// Get all identified charging patterns
app.get('/api/patterns', (req, res) => {
  res.json(chargingPatterns);
});

// Get patterns for a specific charger
app.get('/api/patterns/charger/:chargerId', (req, res) => {
  const { chargerId } = req.params;
  // Check both fields for backward compatibility
  const chargerPatterns = chargingPatterns.filter(p => 
    p.chargerId === chargerId || p.deviceId === chargerId
  );
  res.json(chargerPatterns);
});

// Backward compatibility: old endpoint name
app.get('/api/patterns/device/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  // Check both fields for backward compatibility
  const chargerPatterns = chargingPatterns.filter(p => 
    p.chargerId === deviceId || p.deviceId === deviceId
  );
  res.json(chargerPatterns);
});

// Trigger pattern analysis manually
app.post('/api/patterns/analyze', async (req, res) => {
  try {
    console.log('Manual pattern analysis triggered via API');
    await runPatternAnalysis();
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

// Rerun pattern recognition - clears all patterns and reanalyzes from scratch
app.post('/api/patterns/rerun', async (req, res) => {
  try {
    console.log('Rerun pattern recognition triggered via API');
    
    // Clear all existing patterns - this will cause all patterns to be recreated
    chargingPatterns = [];
    
    // Run pattern analysis from scratch
    // This will create new patterns based on all completed processes
    await runPatternAnalysis();
    
    res.json({ 
      success: true, 
      message: 'Pattern recognition rerun completed',
      patternsFound: chargingPatterns.length,
      totalProcesses: chargingProcesses.length,
      completedProcesses: chargingProcesses.filter(p => p.endTime).length
    });
  } catch (error) {
    console.error('Error rerunning pattern recognition:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to rerun pattern recognition' 
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
      chargerName: p.chargerName || p.deviceName || p.chargerId || p.deviceId,
      deviceName: 'Unknown', // Will be set if pattern matches
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

// Educated guess endpoint for active processes
// Returns likely device matches based on current power consumption profile
// Does NOT store anything or affect patterns - just provides real-time suggestions
app.get('/api/processes/:id/guess', (req, res) => {
  const processId = parseInt(req.params.id);
  
  // Validate that the ID is a valid positive integer
  if (isNaN(processId) || processId <= 0 || !Number.isInteger(processId)) {
    return res.status(400).json({ error: 'Invalid process ID' });
  }
  
  const process = chargingProcesses.find(p => p.id === processId);
  
  if (!process) {
    return res.status(404).json({ error: 'Process not found' });
  }
  
  // Only provide guesses for active (incomplete) processes
  if (process.endTime) {
    return res.json({
      processId: processId,
      isActive: false,
      message: 'Process is completed, no guess needed'
    });
  }
  
  try {
    // Try to match against existing patterns
    const match = patternAnalyzer.findMatchingPattern(process, chargingPatterns);
    
    if (match) {
      res.json({
        processId: processId,
        isActive: true,
        hasGuess: true,
        guessedDevice: match.pattern.deviceName,
        confidence: match.similarity,
        message: 'Educated guess based on power consumption profile'
      });
    } else {
      res.json({
        processId: processId,
        isActive: true,
        hasGuess: false,
        message: 'Not enough data or no matching pattern found'
      });
    }
  } catch (error) {
    console.error(`Error finding pattern match for process ${processId}:`, error);
    res.status(500).json({
      error: 'Failed to generate educated guess',
      processId: processId,
      isActive: true,
      hasGuess: false
    });
  }
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
  
  // If shouldRenameAll is true, update all processes in the pattern to match the new label
  // This ensures that renaming a pattern also renames all its associated CPIs
  // Note: We don't check for result.oldLabel here because we want to update processes
  // even if the pattern previously had no deviceName (e.g., patterns created during analysis)
  if (shouldRenameAll) {
    const pattern = chargingPatterns.find(p => p.id === patternId);
    if (pattern && pattern.processIds) {
      let updatedCount = 0;
      pattern.processIds.forEach(processId => {
        const process = chargingProcesses.find(p => p.id === processId);
        if (process) {
          // Update deviceName to reflect the charged device (e.g., "iPhone", "TonieBox")
          // Note: deviceName historically meant charger name (backward compatibility), 
          // but is now being repurposed to mean the device being charged
          process.deviceName = trimmedLabel;
          updatedCount++;
        }
      });
      
      if (updatedCount > 0) {
        console.log(`Updated deviceName for ${updatedCount} processes to "${trimmedLabel}"`);
      }
      
      // Always save processes when shouldRenameAll is true, even if updatedCount is 0
      // This maintains consistency with the pattern save below
      storage.saveProcesses(chargingProcesses);
    }
  }
  
  // Save updated patterns after process updates to maintain consistency
  patternAnalyzer.savePatterns(chargingPatterns);
  
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
        // Update deviceName to reflect the charged device (e.g., "iPhone", "TonieBox")
        // Note: deviceName historically meant charger name (backward compatibility), 
        // but is now being repurposed to mean the device being charged
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
  
  // Note: Pattern analysis is NOT run automatically
  // Patterns are loaded from disk and used as-is
  // Pattern analysis only runs when explicitly triggered via API endpoints:
  // - POST /api/patterns/analyze - Manually trigger pattern analysis
  // - POST /api/patterns/rerun - Clear all patterns and reanalyze from scratch
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
  patternAnalyzer.savePatterns(chargingPatterns);
  
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
