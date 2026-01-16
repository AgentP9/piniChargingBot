# Quick Deployment Guide

## Prerequisites
- Docker and Docker Compose installed
- MQTT-enabled devices (e.g., Shelly Plug S) or MQTT simulator
- An MQTT broker (e.g., Mosquitto, HiveMQ, or any MQTT-compatible broker)

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
   docker compose up -d
   ```

3. **Access the application**:
   - Web UI: http://localhost:1818
   - Backend API: Available only through frontend proxy at http://localhost:1818/api/health

## Testing with Simulated Data

If you need to simulate MQTT messages for testing, you can use any MQTT client tool such as:
- MQTT Explorer (GUI tool)
- mosquitto_pub command line tool
- MQTT.fx
- Any programmatic MQTT client

Example using mosquitto_pub (if installed):
```bash
# Simulate power on
mosquitto_pub -h your-broker-host -t "shellyplug-s-12345/relay/0" -m "on"

# Simulate power consumption
mosquitto_pub -h your-broker-host -t "shellyplug-s-12345/relay/0/power" -m "15.5"

# Simulate power off
mosquitto_pub -h your-broker-host -t "shellyplug-s-12345/relay/0" -m "off"
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
│ Nginx (Port 1818)│
│   React + Vite   │
└──────┬───────────┘
       │ Proxies /api
       ▼
┌──────────────────┐      MQTT      ┌────────────────┐
│ Backend (Node.js)├───────────────►│  MQTT Broker   │
│  (Internal only) │◄───────────────┤  (External)    │
└──────┬───────────┘                └────────┬───────┘
       │                                     │
       │ Persistent storage                  │
       ▼ (JSON files)                        │
┌──────────────────┐                         │
│  Docker Volume   │                         │
│  /app/data       │                         ▼
└──────────────────┘                ┌────────────────┐
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
- ✅ Persistent file-based storage (survives restarts)
- ✅ Graceful shutdown with data preservation
- ✅ Atomic write operations to prevent corruption

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
- ✅ Environment-based configuration
- ✅ Health check endpoints
- ✅ Persistent volumes for data storage

## Environment Variables

```env
# MQTT Configuration
MQTT_BROKER_URL=mqtt://192.168.1.100:1883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password

# Device Configuration
# New format: Name:topic (allows custom names and topics)
MQTT_DEVICES=Office Charger:shellies/shellyplug07,Kitchen Charger:shellies/shellyplug02
# Legacy format (backward compatible): deviceId
# MQTT_DEVICES=device1,device2,device3
```

## MQTT Topic Structure

For each device configuration:
- **Power On/Off**: `{topic}/relay/0`
  - Messages: "on", "off", "1", "0", "true", "false"
- **Power Consumption**: `{topic}/relay/0/power`
  - Messages: Numeric watts (e.g., "15.5")

**Example with new format:**
- Device: `Office Charger:shellies/shellyplug07`
- Power topic: `shellies/shellyplug07/relay/0`
- Consumption topic: `shellies/shellyplug07/relay/0/power`
- Display name: "Office Charger"

**Example with legacy format:**
- Device: `device1`
- Power topic: `device1/relay/0`
- Consumption topic: `device1/relay/0/power`
- Display name: "device1"

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

## Updating the Application

### Safe Update Procedure (Preserves Data)

When pulling the latest changes from GitHub, follow this procedure to keep your data:

```bash
# Pull latest code
git pull origin main

# Rebuild and restart (preserves backend-data volume)
docker-compose up -d --build

# Verify data was loaded
docker-compose logs backend | grep "Loaded.*processes"
```

**Important:** Do NOT use `docker-compose down -v` as this removes volumes and deletes all data!

For detailed instructions on data persistence, backups, and recovery, see [DATA_PERSISTENCE.md](DATA_PERSISTENCE.md).

## Data Model

### Data Persistence

Charging processes are stored persistently in JSON files within a Docker volume:
- **Location**: `/app/data` in the backend container
- **Volume**: `backend-data` (named Docker volume)
- **Files**:
  - `charging-processes.json` - All charging processes with events
  - `process-counter.json` - Process ID counter for unique identification
- **Features**:
  - Automatic save on power on/off events
  - Throttled saves for power consumption (max once per 5 seconds)
  - Atomic writes to prevent corruption
  - Graceful shutdown ensures data is saved
  - Data persists across container restarts and redeployments

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
# Check your MQTT broker logs
```

### Frontend not loading
```bash
docker compose logs frontend
# Check http://localhost:1818/api/health
```

### No data appearing
1. Verify MQTT messages are being published
2. Check backend logs for MQTT subscription confirmations
3. Ensure device IDs match exactly (case-sensitive)

## Production Considerations

For production deployment, consider:

1. **Database**: The current file-based storage is suitable for small to medium deployments. For high-volume production with multiple backend instances, consider migrating to PostgreSQL/MongoDB
2. **Authentication**: Add user authentication and API keys
3. **HTTPS**: Configure SSL certificates for encrypted communication
4. **Monitoring**: Add application monitoring (Prometheus, Grafana)
5. **Backup**: Implement automated backup strategies for the data volume
6. **Rate Limiting**: Add API rate limiting to prevent abuse
7. **Security**: Implement MQTT authentication and ACLs

## Contributing

Feel free to submit issues and enhancement requests!

## License

ISC
