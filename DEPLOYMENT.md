# Quick Deployment Guide

## Prerequisites
- Docker and Docker Compose installed
- MQTT-enabled devices (e.g., Shelly Plug S) or MQTT simulator

## Quick Start

1. **Clone and configure**:
   ```bash
   git clone https://github.com/AgentP9/piniChargingBot.git
   cd piniChargingBot
   cp .env.example .env
   # Edit .env with your MQTT broker details and device IDs
   ```

2. **Start the stack**:
   ```bash
   # Using your existing MQTT broker (default)
   docker compose up -d
   
   # OR, to use the built-in Mosquitto broker
   docker compose --profile with-mosquitto up -d
   ```

3. **Access the application**:
   - Web UI: http://localhost
   - Backend API: http://localhost:3000/api/health
   - MQTT Broker (if using built-in): localhost:1883

## Testing with Simulated Data

Use the provided test script to simulate charging cycles:

```bash
# Install mosquitto clients if needed
sudo apt-get install mosquitto-clients

# Using your existing broker
./test-mqtt.sh shellyplug-s-12345 your-broker-host

# Using built-in mosquitto (if started with --profile with-mosquitto)
./test-mqtt.sh shellyplug-s-12345 localhost
```

## Architecture Overview

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ HTTP/API
       ▼
┌──────────────────┐
│  Nginx (Port 80) │
│   React + Vite   │
└──────┬───────────┘
       │ Proxies /api
       ▼
┌──────────────────┐      MQTT      ┌────────────────┐
│ Backend (Node.js)├───────────────►│ Mosquitto MQTT │
│   Port 3000      │◄───────────────┤   Broker       │
└──────────────────┘                └────────┬───────┘
       │                                     │
       │ Stores in memory                    │
       │ (Events & Processes)                │
       │                                     │
       │                                     ▼
       │                            ┌────────────────┐
       │                            │  Shelly Plugs  │
       │                            │  (IoT Devices) │
       │                            └────────────────┘
       │
       ▼
 ┌─────────────┐
 │   Charts &  │
 │  Analytics  │
 └─────────────┘
```

## Features Implemented

### Backend
- ✅ MQTT client with automatic reconnection
- ✅ Configurable device subscriptions via environment variables
- ✅ Real-time event tracking (power on/off, power consumption)
- ✅ Charging process lifecycle management
- ✅ REST API for frontend communication
- ✅ In-memory data storage (easily replaceable with database)

### Frontend
- ✅ Modern, responsive React UI with Vite
- ✅ Real-time device status display
- ✅ Charging process list with filtering
- ✅ Interactive power consumption charts (Recharts)
- ✅ Process selection and detailed view
- ✅ Auto-refresh every 5 seconds
- ✅ Mobile-friendly responsive design

### DevOps
- ✅ Multi-stage Docker builds for optimization
- ✅ Docker Compose orchestration
- ✅ Nginx reverse proxy for frontend
- ✅ Embedded MQTT broker (Mosquitto)
- ✅ Environment-based configuration
- ✅ Health check endpoints

## Environment Variables

```env
# MQTT Configuration
# Using external broker (default):
MQTT_BROKER_URL=mqtt://your-broker-host:1883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password

# OR, using built-in mosquitto (requires --profile with-mosquitto):
# MQTT_BROKER_URL=mqtt://mosquitto:1883
# MQTT_USERNAME=
# MQTT_PASSWORD=

# Device Configuration
MQTT_DEVICES=device1,device2,device3
```

## MQTT Topic Structure

For each device ID `{DEVICE_ID}`:
- **Power On/Off**: `{DEVICE_ID}/relay/0`
  - Messages: "on", "off", "1", "0", "true", "false"
- **Power Consumption**: `{DEVICE_ID}/relay/0/power`
  - Messages: Numeric watts (e.g., "15.5")

## API Endpoints

### Health & Status
- `GET /api/health` - System health check

### Devices
- `GET /api/devices` - List all devices
- `GET /api/devices/:deviceId` - Get specific device state

### Charging Processes
- `GET /api/processes` - List all processes
- `GET /api/processes/:id` - Get specific process details
- `GET /api/processes/device/:deviceId` - Get processes for a device

## Data Model

### Charging Process
```javascript
{
  id: 1,
  deviceId: "shellyplug-s-12345",
  startTime: "2026-01-09T06:30:00.000Z",
  endTime: "2026-01-09T07:15:00.000Z", // null if active
  events: [
    {
      timestamp: "2026-01-09T06:30:00.000Z",
      type: "power_on",
      value: true
    },
    {
      timestamp: "2026-01-09T06:30:05.000Z",
      type: "power_consumption",
      value: 15.5
    },
    // ... more events
  ]
}
```

## Troubleshooting

### Backend can't connect to MQTT
```bash
docker compose logs backend
docker compose logs mosquitto
```

### Frontend not loading
```bash
docker compose logs frontend
# Check http://localhost:3000/api/health
```

### No data appearing
1. Verify MQTT messages are being published
2. Check backend logs for MQTT subscription confirmations
3. Ensure device IDs match exactly (case-sensitive)

## Production Considerations

For production deployment, consider:

1. **Database**: Replace in-memory storage with PostgreSQL/MongoDB
2. **Authentication**: Add user authentication and API keys
3. **HTTPS**: Configure SSL certificates for encrypted communication
4. **Monitoring**: Add application monitoring (Prometheus, Grafana)
5. **Persistence**: Configure persistent volumes for database and logs
6. **Backup**: Implement automated backup strategies
7. **Rate Limiting**: Add API rate limiting to prevent abuse
8. **Security**: Implement MQTT authentication and ACLs

## Contributing

Feel free to submit issues and enhancement requests!

## License

ISC
