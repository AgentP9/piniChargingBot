#!/bin/bash

# MQTT Test Script
# This script simulates a charging device by publishing MQTT messages
# Usage: ./test-mqtt.sh [device-id]

DEVICE_ID=${1:-shellyplug-s-12345}
MQTT_BROKER=${2:-localhost}

echo "Simulating charging device: $DEVICE_ID"
echo "MQTT Broker: $MQTT_BROKER"
echo ""
echo "Starting charging simulation..."
echo ""

# Check if mosquitto_pub is available
if ! command -v mosquitto_pub &> /dev/null; then
    echo "Error: mosquitto_pub is not installed"
    echo "Install with: sudo apt-get install mosquitto-clients"
    exit 1
fi

# Simulate power on
echo "1. Turning power ON..."
mosquitto_pub -h $MQTT_BROKER -t "${DEVICE_ID}/relay/0" -m "on"
sleep 1

# Simulate power consumption over time
echo "2. Simulating power consumption (charging)..."
for i in {1..20}; do
    # Random power between 5 and 25 watts (typical phone/tablet charging)
    POWER=$(awk -v min=5 -v max=25 'BEGIN{srand(); print min+rand()*(max-min)}')
    echo "   Power: ${POWER}W"
    mosquitto_pub -h $MQTT_BROKER -t "${DEVICE_ID}/relay/0/power" -m "$POWER"
    sleep 2
done

# Simulate power off
echo "3. Turning power OFF..."
mosquitto_pub -h $MQTT_BROKER -t "${DEVICE_ID}/relay/0" -m "off"
sleep 1

echo ""
echo "Charging simulation complete!"
echo "Check the web interface at http://localhost to see the charging process."
