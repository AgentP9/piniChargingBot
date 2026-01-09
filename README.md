# piniChargingBot

A Docker-based application for monitoring device charging via MQTT-compatible power plugs (e.g., Shelly Plug S).

## Features

- **Real-time MQTT Monitoring**: Connects to MQTT broker and subscribes to configurable device topics
- **Charging Process Tracking**: Automatically tracks charging sessions based on power on/off events
- **Power Consumption Logging**: Records power consumption data with timestamps
- **Modern Responsive UI**: Web interface with real-time updates and interactive charts
- **Multi-Device Support**: Monitor multiple devices simultaneously
- **Docker Deployment**: Easy deployment with Docker Compose

## Architecture

The application consists of two main components:

1. **Backend (Node.js + Express)**: 
   - MQTT client that subscribes to device topics
   - REST API for frontend communication
   - In-memory storage of charging processes and events

2. **Frontend (React + Recharts)**:
   - Modern, responsive web interface
   - Real-time device status display
   - Interactive power consumption charts
   - Charging process selection and visualization

3. **MQTT Broker (Optional)**:
   - Can optionally include Eclipse Mosquitto broker
   - Designed to work with your existing MQTT broker

## Prerequisites

- Docker and Docker Compose installed (or Portainer for web-based management)
- MQTT-compatible power plugs (e.g., Shelly Plug S) configured to publish to MQTT
- An existing MQTT broker (or use the optional built-in Mosquitto broker)

## Quick Start

### Option 1: Docker Compose (Command Line)

1. Clone the repository:
   ```bash
   git clone https://github.com/AgentP9/piniChargingBot.git
   cd piniChargingBot
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure your MQTT broker and devices:
   ```env
   # Use your existing MQTT broker
   MQTT_BROKER_URL=mqtt://your-broker-host:1883
   MQTT_USERNAME=your-username  # if required
   MQTT_PASSWORD=your-password  # if required
   MQTT_DEVICES=shellyplug-s-12345,shellyplug-s-67890
   ```

3. Start the application:
   ```bash
   docker-compose up -d
   ```
   
   **Note:** If you want to use the built-in Mosquitto broker instead:
   ```bash
   # Update MQTT_BROKER_URL in .env to: mqtt://mosquitto:1883
   docker-compose --profile with-mosquitto up -d
   ```

4. Access the web interface:
   - Frontend: http://localhost
   - Backend API: http://localhost:3000/api/health

### Option 2: Portainer (Web-based Management)

For users who prefer a graphical interface to manage Docker containers, Portainer provides an easy way to deploy and configure the application.

**See [PORTAINER.md](PORTAINER.md) for detailed instructions on:**
- Deploying the stack via Portainer
- Configuring environment variables through the web UI
- Managing and monitoring containers
- Updating configuration without command line

Quick Portainer steps:
1. Access your Portainer instance
2. Go to **Stacks** → **+ Add stack**
3. Use Git repository: `https://github.com/AgentP9/piniChargingBot`
4. Configure environment variables in the web UI
5. Deploy the stack

## Configuration

### Environment Variables

All configuration can be managed via environment variables (through `.env` file or Portainer):

- `MQTT_BROKER_URL`: MQTT broker URL (e.g., `mqtt://your-broker:1883`)
- `MQTT_USERNAME`: MQTT username (optional)
- `MQTT_PASSWORD`: MQTT password (optional)
- `MQTT_DEVICES`: Comma-separated list of device IDs (e.g., Shelly Plug names)

### Using with External MQTT Broker (Default)

The application is designed to work with your existing MQTT broker:

1. Update the `.env` file with your broker details:
   ```env
   MQTT_BROKER_URL=mqtt://your-broker-address:1883
   MQTT_USERNAME=your-username
   MQTT_PASSWORD=your-password
   MQTT_DEVICES=device1,device2
   ```

2. Start the application (mosquitto service will not be started):
   ```bash
   docker-compose up -d
   ```

### Using Built-in Mosquitto Broker (Optional)

If you don't have an MQTT broker, you can use the included Mosquitto:

1. Update the `.env` file:
   ```env
   MQTT_BROKER_URL=mqtt://mosquitto:1883
   MQTT_DEVICES=device1,device2
   ```

2. Start with the mosquitto profile:
   ```bash
   docker-compose --profile with-mosquitto up -d
   ```

### MQTT Topics

For each device with ID `{DEVICE_ID}`, the backend subscribes to:
- `{DEVICE_ID}/relay/0` - Power on/off events
- `{DEVICE_ID}/relay/0/power` - Power consumption in Watts

Example for Shelly Plug S named "shellyplug-s-12345":
- `shellyplug-s-12345/relay/0` - Receives "on" or "off"
- `shellyplug-s-12345/relay/0/power` - Receives power value (e.g., "15.5")

## API Endpoints

- `GET /api/health` - Health check and MQTT connection status
- `GET /api/devices` - Get all device states
- `GET /api/devices/:deviceId` - Get specific device state
- `GET /api/processes` - Get all charging processes
- `GET /api/processes/:id` - Get specific charging process
- `GET /api/processes/device/:deviceId` - Get processes for a device

## Development

### Backend Development

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MQTT broker configuration
npm run dev
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:5173 with hot reload enabled.

## Using with External MQTT Broker

See the Configuration section above for details on connecting to your existing MQTT broker.

## Data Storage

Currently, the application uses in-memory storage for charging processes. For production use, consider implementing persistent storage using a database (e.g., MongoDB, PostgreSQL).

## Monitoring Multiple Devices

Add multiple device IDs to the `MQTT_DEVICES` environment variable:

```env
MQTT_DEVICES=living-room-plug,bedroom-plug,garage-plug
```

Each device will be monitored independently, and the UI will display all devices and their charging processes.

## Troubleshooting

### Backend can't connect to MQTT broker
- Check that the MQTT broker is running: `docker-compose logs mosquitto`
- Verify the `MQTT_BROKER_URL` in your `.env` file
- Check firewall settings if using external broker

### No data showing in frontend
- Verify backend is running: `docker-compose logs backend`
- Check backend health: http://localhost:3000/api/health
- Ensure devices are publishing to the correct MQTT topics

### Frontend can't connect to backend
- Check that backend is running on port 3000
- Check browser console for errors
- Verify CORS settings if running frontend separately

## License

ISC

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
