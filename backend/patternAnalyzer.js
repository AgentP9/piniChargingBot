const fs = require('fs');
const path = require('path');

// Data directory for persistent storage
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PATTERNS_FILE = path.join(DATA_DIR, 'charging-patterns.json');

/**
 * Ensure the data directory exists
 */
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Calculate power consumption profile characteristics for a charging process
 * This creates a "fingerprint" of how power is consumed over time
 * @param {Object} process - A charging process with events
 * @returns {Object} Power profile characteristics
 */
function calculatePowerProfile(process) {
  const powerEvents = process.events.filter(e => e.type === 'power_consumption' && e.value > 0);
  
  // Require at least 3 power consumption events for reliable pattern analysis
  if (powerEvents.length < 3) {
    console.log(`Process ${process.id}: Insufficient power data (${powerEvents.length} events, need 3+)`);
    return null;
  }
  
  const powerValues = powerEvents.map(e => e.value);
  const sum = powerValues.reduce((a, b) => a + b, 0);
  const mean = sum / powerValues.length;
  
  // Calculate standard deviation
  const variance = powerValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / powerValues.length;
  const stdDev = Math.sqrt(variance);
  
  // Calculate min, max
  const min = Math.min(...powerValues);
  const max = Math.max(...powerValues);
  
  // Calculate percentiles
  const sorted = [...powerValues].sort((a, b) => a - b);
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p50 = sorted[Math.floor(sorted.length * 0.5)]; // median
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  
  // Calculate peak power period (sustained high power)
  const highPowerThreshold = mean + stdDev;
  const highPowerEvents = powerEvents.filter(e => e.value >= highPowerThreshold);
  const peakPowerRatio = highPowerEvents.length / powerEvents.length;
  
  // Calculate power consumption curve shape
  // Divide into early, middle, late phases
  const third = Math.max(1, Math.floor(powerEvents.length / 3));
  const earlyEvents = powerEvents.slice(0, third);
  const middleEvents = powerEvents.slice(third, third * 2);
  const lateEvents = powerEvents.slice(third * 2);
  
  const earlyMean = earlyEvents.length > 0 ? earlyEvents.reduce((sum, e) => sum + e.value, 0) / earlyEvents.length : mean;
  const middleMean = middleEvents.length > 0 ? middleEvents.reduce((sum, e) => sum + e.value, 0) / middleEvents.length : mean;
  const lateMean = lateEvents.length > 0 ? lateEvents.reduce((sum, e) => sum + e.value, 0) / lateEvents.length : mean;
  
  return {
    mean: parseFloat(mean.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    median: parseFloat(p50.toFixed(2)),
    p25: parseFloat(p25.toFixed(2)),
    p75: parseFloat(p75.toFixed(2)),
    peakPowerRatio: parseFloat(peakPowerRatio.toFixed(3)),
    curveShape: {
      early: parseFloat(earlyMean.toFixed(2)),
      middle: parseFloat(middleMean.toFixed(2)),
      late: parseFloat(lateMean.toFixed(2))
    }
  };
}

/**
 * Calculate duration of a charging process in minutes
 * @param {Object} process - A charging process
 * @returns {number|null} Duration in minutes, or null if not completed
 */
function calculateDuration(process) {
  if (!process.endTime) {
    return null;
  }
  
  const start = new Date(process.startTime);
  const end = new Date(process.endTime);
  return (end - start) / 1000 / 60; // Convert to minutes
}

/**
 * Calculate similarity score between two power profiles
 * @param {Object} profile1 - First power profile
 * @param {Object} profile2 - Second power profile
 * @returns {number} Similarity score (0-1, where 1 is identical)
 */
function calculateProfileSimilarity(profile1, profile2) {
  if (!profile1 || !profile2) {
    return 0;
  }
  
  // Weight different characteristics
  const weights = {
    mean: 0.20,
    median: 0.15,
    stdDev: 0.10,
    peakPowerRatio: 0.15,
    curveShape: 0.40
  };
  
  let totalSimilarity = 0;
  
  // Compare mean power
  const meanDiff = Math.abs(profile1.mean - profile2.mean);
  const meanSimilarity = Math.max(0, 1 - meanDiff / Math.max(profile1.mean, profile2.mean));
  totalSimilarity += meanSimilarity * weights.mean;
  
  // Compare median
  const medianDiff = Math.abs(profile1.median - profile2.median);
  const medianSimilarity = Math.max(0, 1 - medianDiff / Math.max(profile1.median, profile2.median));
  totalSimilarity += medianSimilarity * weights.median;
  
  // Compare standard deviation
  const stdDevDiff = Math.abs(profile1.stdDev - profile2.stdDev);
  const stdDevSimilarity = Math.max(0, 1 - stdDevDiff / Math.max(profile1.stdDev, profile2.stdDev, 1));
  totalSimilarity += stdDevSimilarity * weights.stdDev;
  
  // Compare peak power ratio
  const peakDiff = Math.abs(profile1.peakPowerRatio - profile2.peakPowerRatio);
  const peakSimilarity = Math.max(0, 1 - peakDiff);
  totalSimilarity += peakSimilarity * weights.peakPowerRatio;
  
  // Compare curve shape (most important for device identification)
  const earlyDiff = Math.abs(profile1.curveShape.early - profile2.curveShape.early);
  const middleDiff = Math.abs(profile1.curveShape.middle - profile2.curveShape.middle);
  const lateDiff = Math.abs(profile1.curveShape.late - profile2.curveShape.late);
  const maxCurveValue = Math.max(
    profile1.curveShape.early, profile1.curveShape.middle, profile1.curveShape.late,
    profile2.curveShape.early, profile2.curveShape.middle, profile2.curveShape.late,
    1
  );
  const curveSimilarity = Math.max(0, 1 - (earlyDiff + middleDiff + lateDiff) / (3 * maxCurveValue));
  totalSimilarity += curveSimilarity * weights.curveShape;
  
  return parseFloat(totalSimilarity.toFixed(3));
}

/**
 * Analyze charging processes and identify patterns
 * Groups similar charging sessions together to identify the same devices
 * @param {Array} processes - Array of all charging processes
 * @returns {Array} Array of identified patterns with grouped processes
 */
function analyzePatterns(processes) {
  console.log(`Pattern analysis: Starting with ${processes.length} total processes`);
  
  // Only analyze completed processes with power data
  const completedProcesses = processes.filter(p => 
    p.endTime && 
    p.events.some(e => e.type === 'power_consumption')
  );
  
  console.log(`Pattern analysis: ${completedProcesses.length} completed processes with power data`);
  
  if (completedProcesses.length === 0) {
    console.log('Pattern analysis: No completed processes to analyze');
    return [];
  }
  
  // Calculate profiles for all processes
  const processesWithProfiles = completedProcesses.map(process => ({
    process,
    profile: calculatePowerProfile(process),
    duration: calculateDuration(process)
  })).filter(p => p.profile !== null);
  
  console.log(`Pattern analysis: ${processesWithProfiles.length} processes with valid profiles`);
  
  if (processesWithProfiles.length === 0) {
    console.log('Pattern analysis: No processes with valid power profiles');
    return [];
  }
  
  // Group similar processes into patterns
  const patterns = [];
  const similarityThreshold = 0.65; // Processes with similarity > 0.65 are considered the same device
  
  processesWithProfiles.forEach(({ process, profile, duration }) => {
    // Find existing pattern that matches
    let matchedPattern = null;
    let maxSimilarity = 0;
    
    for (const pattern of patterns) {
      const similarity = calculateProfileSimilarity(profile, pattern.averageProfile);
      if (similarity > maxSimilarity && similarity >= similarityThreshold) {
        maxSimilarity = similarity;
        matchedPattern = pattern;
      }
    }
    
    if (matchedPattern) {
      // Add to existing pattern
      matchedPattern.processIds.push(process.id);
      matchedPattern.count++;
      matchedPattern.durations.push(duration);
      matchedPattern.lastSeen = process.endTime;
      
      // Update average profile (simple running average)
      const oldWeight = matchedPattern.count - 1;
      const newWeight = 1;
      const totalWeight = matchedPattern.count;
      
      for (const key of ['mean', 'stdDev', 'min', 'max', 'median', 'p25', 'p75', 'peakPowerRatio']) {
        matchedPattern.averageProfile[key] = parseFloat(
          ((matchedPattern.averageProfile[key] * oldWeight + profile[key] * newWeight) / totalWeight).toFixed(2)
        );
      }
      
      for (const phase of ['early', 'middle', 'late']) {
        matchedPattern.averageProfile.curveShape[phase] = parseFloat(
          ((matchedPattern.averageProfile.curveShape[phase] * oldWeight + profile.curveShape[phase] * newWeight) / totalWeight).toFixed(2)
        );
      }
    } else {
      // Create new pattern
      const patternId = `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      patterns.push({
        id: patternId,
        chargerId: process.chargerId,
        chargerName: process.chargerName || process.chargerId,
        deviceName: process.deviceName || process.chargerId, // Will be set by user via label management
        count: 1,
        processIds: [process.id],
        averageProfile: { ...profile },
        durations: [duration],
        firstSeen: process.startTime,
        lastSeen: process.endTime
      });
    }
  });
  
  // Calculate statistics for each pattern
  patterns.forEach(pattern => {
    const durations = pattern.durations;
    durations.sort((a, b) => a - b);
    
    pattern.statistics = {
      averageDuration: parseFloat((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)),
      minDuration: parseFloat(Math.min(...durations).toFixed(2)),
      maxDuration: parseFloat(Math.max(...durations).toFixed(2)),
      medianDuration: parseFloat(durations[Math.floor(durations.length / 2)].toFixed(2)),
      totalSessions: pattern.count
    };
    
    // Remove raw durations array to save space
    delete pattern.durations;
    
    console.log(`Pattern ${pattern.id}: ${pattern.count} sessions, processes: [${pattern.processIds.join(', ')}]`);
  });
  
  // Sort patterns by frequency (most common first)
  patterns.sort((a, b) => b.count - a.count);
  
  console.log(`Pattern analysis complete: Found ${patterns.length} patterns`);
  
  return patterns;
}

/**
 * Load patterns from file
 * @returns {Array} Array of patterns
 */
function loadPatterns() {
  ensureDataDirectory();
  
  try {
    if (fs.existsSync(PATTERNS_FILE)) {
      const data = fs.readFileSync(PATTERNS_FILE, 'utf8');
      const patterns = JSON.parse(data);
      console.log(`Loaded ${patterns.length} charging patterns from storage`);
      return patterns;
    }
  } catch (error) {
    console.error('Error loading patterns from file:', error);
  }
  
  return [];
}

/**
 * Save patterns to file
 * @param {Array} patterns - Array of patterns to save
 */
function savePatterns(patterns) {
  ensureDataDirectory();
  
  try {
    const tempFile = `${PATTERNS_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(patterns, null, 2), 'utf8');
    fs.renameSync(tempFile, PATTERNS_FILE);
    console.log(`Saved ${patterns.length} charging patterns to storage`);
  } catch (error) {
    console.error('Error saving patterns to file:', error);
  }
}

/**
 * Find the pattern that best matches a given process
 * @param {Object} process - A charging process
 * @param {Array} patterns - Array of existing patterns
 * @returns {Object|null} Matching pattern or null if no match found
 */
function findMatchingPattern(process, patterns) {
  const profile = calculatePowerProfile(process);
  if (!profile) {
    return null;
  }
  
  let bestMatch = null;
  let bestSimilarity = 0;
  const similarityThreshold = 0.65;
  
  for (const pattern of patterns) {
    const similarity = calculateProfileSimilarity(profile, pattern.averageProfile);
    if (similarity > bestSimilarity && similarity >= similarityThreshold) {
      bestSimilarity = similarity;
      bestMatch = {
        pattern,
        similarity: parseFloat(similarity.toFixed(3))
      };
    }
  }
  
  return bestMatch;
}

// Constants for profile merging
const PROFILE_KEYS = ['mean', 'stdDev', 'min', 'max', 'median', 'p25', 'p75', 'peakPowerRatio'];
const CURVE_PHASES = ['early', 'middle', 'late'];

/**
 * Update the device label for a pattern
 * Ensures label uniqueness by checking against other patterns
 * @param {Array} patterns - Array of all patterns
 * @param {string} patternId - ID of the pattern to update
 * @param {string} newLabel - New device label
 * @returns {Object} Result with success status and message
 */
function updatePatternLabel(patterns, patternId, newLabel) {
  const pattern = patterns.find(p => p.id === patternId);
  
  if (!pattern) {
    return { success: false, error: 'Pattern not found' };
  }
  
  // Check if label already exists in another pattern
  const existingPattern = patterns.find(p => p.id !== patternId && p.deviceName === newLabel);
  
  if (existingPattern) {
    return { success: false, error: 'Label already exists', shouldMerge: true, targetPatternId: existingPattern.id };
  }
  
  const oldLabel = pattern.deviceName;
  pattern.deviceName = newLabel;
  
  return { success: true, oldLabel, newLabel, patternId };
}

/**
 * Merge two patterns into one
 * Combines process IDs and recalculates statistics
 * @param {Array} patterns - Array of all patterns
 * @param {string} sourcePatternId - ID of pattern to merge from (will be removed)
 * @param {string} targetPatternId - ID of pattern to merge into (will be kept)
 * @returns {Object} Result with success status and updated patterns
 */
function mergePatterns(patterns, sourcePatternId, targetPatternId) {
  const sourceIndex = patterns.findIndex(p => p.id === sourcePatternId);
  const targetPattern = patterns.find(p => p.id === targetPatternId);
  
  if (sourceIndex === -1 || !targetPattern) {
    return { success: false, error: 'Pattern(s) not found' };
  }
  
  const sourcePattern = patterns[sourceIndex];
  
  // Merge process IDs
  targetPattern.processIds = [...targetPattern.processIds, ...sourcePattern.processIds];
  
  // Update count
  const oldTargetCount = targetPattern.count;
  targetPattern.count = targetPattern.processIds.length;
  
  // Merge average profile (weighted average based on counts)
  const sourceWeight = sourcePattern.count;
  const targetWeight = oldTargetCount;
  const totalWeight = sourceWeight + targetWeight;
  
  for (const key of PROFILE_KEYS) {
    if (key === 'min') {
      targetPattern.averageProfile[key] = Math.min(targetPattern.averageProfile[key], sourcePattern.averageProfile[key]);
    } else if (key === 'max') {
      targetPattern.averageProfile[key] = Math.max(targetPattern.averageProfile[key], sourcePattern.averageProfile[key]);
    } else {
      targetPattern.averageProfile[key] = parseFloat(
        ((targetPattern.averageProfile[key] * targetWeight + sourcePattern.averageProfile[key] * sourceWeight) / totalWeight).toFixed(2)
      );
    }
  }
  
  for (const phase of CURVE_PHASES) {
    targetPattern.averageProfile.curveShape[phase] = parseFloat(
      ((targetPattern.averageProfile.curveShape[phase] * targetWeight + sourcePattern.averageProfile.curveShape[phase] * sourceWeight) / totalWeight).toFixed(2)
    );
  }
  
  // Update timestamps
  if (new Date(sourcePattern.firstSeen) < new Date(targetPattern.firstSeen)) {
    targetPattern.firstSeen = sourcePattern.firstSeen;
  }
  if (new Date(sourcePattern.lastSeen) > new Date(targetPattern.lastSeen)) {
    targetPattern.lastSeen = sourcePattern.lastSeen;
  }
  
  // Merge statistics by recalculating from combined data
  if (sourcePattern.statistics && targetPattern.statistics) {
    // We don't have the raw durations, so we'll approximate
    const sourceTotalDuration = sourcePattern.statistics.averageDuration * sourcePattern.count;
    const targetTotalDuration = targetPattern.statistics.averageDuration * oldTargetCount;
    targetPattern.statistics.averageDuration = parseFloat(
      ((sourceTotalDuration + targetTotalDuration) / totalWeight).toFixed(2)
    );
    targetPattern.statistics.minDuration = Math.min(
      targetPattern.statistics.minDuration, 
      sourcePattern.statistics.minDuration
    );
    targetPattern.statistics.maxDuration = Math.max(
      targetPattern.statistics.maxDuration, 
      sourcePattern.statistics.maxDuration
    );
    targetPattern.statistics.totalSessions = totalWeight;
  }
  
  // Remove source pattern
  patterns.splice(sourceIndex, 1);
  
  return { success: true, mergedPattern: targetPattern, removedPatternId: sourcePatternId };
}

/**
 * Delete a pattern
 * @param {Array} patterns - Array of all patterns
 * @param {string} patternId - ID of pattern to delete
 * @returns {Object} Result with success status
 */
function deletePattern(patterns, patternId) {
  const index = patterns.findIndex(p => p.id === patternId);
  
  if (index === -1) {
    return { success: false, error: 'Pattern not found' };
  }
  
  const pattern = patterns[index];
  patterns.splice(index, 1);
  
  return { success: true, deletedPattern: pattern };
}

module.exports = {
  analyzePatterns,
  loadPatterns,
  savePatterns,
  calculatePowerProfile,
  calculateDuration,
  calculateProfileSimilarity,
  findMatchingPattern,
  updatePatternLabel,
  mergePatterns,
  deletePattern
};
