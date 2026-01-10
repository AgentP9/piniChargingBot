# piniChargingBot

A Docker-based application for monitoring device charging via MQTT-compatible power plugs (e.g., Shelly Plug S).

## Features

- **Real-time MQTT Monitoring**: Connects to MQTT broker and subscribes to configurable device topics
- **Charging Process Tracking**: Automatically tracks charging sessions based on power on/off events
- **Power Consumption Logging**: Records power consumption data with timestamps
- **Pattern Recognition**: AI-powered device fingerprinting that identifies charged devices based on power consumption characteristics
- **Modern Responsive UI**: Web interface with real-time updates and interactive charts
- **Multi-Device Support**: Monitor multiple devices simultaneously
- **Progressive Web App (PWA)**: Add to your iPhone/Android home screen for a native app experience
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

**Optional MQTT Broker:**
   - Can optionally include Eclipse Mosquitto broker using Docker profiles
   - Designed to work with your existing MQTT broker by default

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
   MQTT_BROKER_URL=mqtt://192.168.1.100:1883
   MQTT_USERNAME=your-username  # if required
   MQTT_PASSWORD=your-password  # if required
   MQTT_DEVICES=Office Charger:shellies/shellyplug07,Kitchen Charger:shellies/shellyplug02
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
   - Frontend: http://localhost:1818
   - Backend API: Available only through frontend proxy at http://localhost:1818/api/health

5. **Add to Home Screen (iOS/Android):**
   - On your mobile device, open the app in your browser
   - **iOS**: Tap the Share button, then "Add to Home Screen"
   - **Android**: Tap the menu (⋮), then "Add to Home Screen" or "Install app"
   - The app will now open as a standalone application without browser UI

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
- `MQTT_DEVICES`: Device configurations in the format `Name:topic` or legacy format `deviceId`
  - New format: `Office Charger:shellies/shellyplug07,Kitchen:shellies/shellyplug02`
  - Legacy format (backward compatible): `shellyplug-s-12345,shellyplug-s-67890`

### Using with External MQTT Broker (Default)

The application is designed to work with your existing MQTT broker:

1. Update the `.env` file with your broker details:
   ```env
   MQTT_BROKER_URL=mqtt://192.168.1.100:1883
   MQTT_USERNAME=your-username
   MQTT_PASSWORD=your-password
   MQTT_DEVICES=Office Charger:shellies/device1,Garage:shellies/device2
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
   MQTT_DEVICES=Office Charger:shellies/device1,Garage:shellies/device2
   ```

2. Start with the mosquitto profile:
   ```bash
   docker-compose --profile with-mosquitto up -d
   ```

### MQTT Topics

For each device configuration, the backend subscribes to:
- `{topic}/relay/0` - Power on/off events
- `{topic}/relay/0/power` - Power consumption in Watts

Example for device configured as "Office Charger:shellies/shellyplug07":
- Subscribes to: `shellies/shellyplug07/relay/0` - Receives "on" or "off"
- Subscribes to: `shellies/shellyplug07/relay/0/power` - Receives power value (e.g., "15.5")
- Displays as: "Office Charger" in the UI

Legacy format example for "shellyplug-s-12345":
- Subscribes to: `shellyplug-s-12345/relay/0` - Receives "on" or "off"
- Subscribes to: `shellyplug-s-12345/relay/0/power` - Receives power value (e.g., "15.5")
- Displays as: "shellyplug-s-12345" in the UI

## Progressive Web App (PWA) Support

The application is a fully functional Progressive Web App that can be installed on mobile devices for a native app experience:

### Features:
- **Standalone Mode**: Opens without browser UI (no Safari/Chrome interface)
- **Home Screen Icon**: Custom app icon on your device's home screen
- **Offline Capability**: Basic offline functionality with service worker caching
- **Responsive Design**: Optimized for mobile and desktop devices

### Installation:

**iOS (iPhone/iPad):**
1. Open the app in Safari (http://your-server:1818)
2. Tap the Share button (square with arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" in the top right corner
5. The app icon will appear on your home screen
6. Open the app - it will launch in standalone mode without Safari UI

**Android:**
1. Open the app in Chrome (http://your-server:1818)
2. Tap the menu button (⋮) in the top right
3. Tap "Add to Home Screen" or "Install app"
4. Tap "Add" to confirm
5. The app icon will appear on your home screen
6. Open the app - it will launch in standalone mode

**Desktop (Chrome/Edge):**
1. Look for the install icon (➕ or computer icon) in the address bar
2. Click the icon and confirm installation
3. The app will open in its own window

### Technical Details:
- Web App Manifest: Configured for standalone display mode
- Service Worker: Provides offline caching for static assets and API responses
- App Icons: Multiple sizes (192x192, 512x512) for different devices
- Apple Touch Icons: Optimized for iOS devices

## API Endpoints

### Device & Process Management

- `GET /api/health` - Health check and MQTT connection status
- `GET /api/devices` - Get all device states
- `GET /api/devices/:deviceId` - Get specific device state
- `GET /api/devices/:deviceId/active-processes` - Get active (incomplete) processes for a device
- `GET /api/processes` - Get all charging processes
- `GET /api/processes/:id` - Get specific charging process
- `GET /api/processes/device/:deviceId` - Get processes for a device
- `PUT /api/processes/:id/complete` - Manually mark a process as complete
- `DELETE /api/processes/:id` - Delete a specific charging process

### Pattern Recognition

- `GET /api/patterns` - Get all identified charging patterns
- `GET /api/patterns/device/:deviceId` - Get patterns for a specific device
- `POST /api/patterns/analyze` - Manually trigger pattern analysis
- `GET /api/processes/:id/pattern` - Get matching pattern for a charging process
- `GET /api/patterns/debug` - Diagnostic endpoint for troubleshooting pattern issues

For detailed information about pattern recognition, see [PATTERN_RECOGNITION.md](PATTERN_RECOGNITION.md).

**Not seeing device names?** Check the [Pattern Recognition Troubleshooting Guide](TROUBLESHOOTING_PATTERNS.md).

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

The application uses file-based persistent storage for charging processes:
- Charging processes are automatically saved to disk
- Data persists across container restarts
- Storage location: `/app/data` in the container (mapped to a Docker volume)
- Saves are throttled (max once per 5 seconds) to minimize disk I/O during high-frequency power readings
- Graceful shutdown ensures all data is saved before the application exits

The data is stored in JSON format and includes:
- All charging processes with start/end times
- Power consumption events with timestamps
- Process ID counter for unique identification

## Monitoring Multiple Devices

Configure multiple devices with custom names and topics using the `MQTT_DEVICES` environment variable:

```env
MQTT_DEVICES=Living Room:shellies/living-room-plug,Bedroom:shellies/bedroom-plug,Garage:home/garage-plug
```

Or use the legacy format (backward compatible):

```env
MQTT_DEVICES=living-room-plug,bedroom-plug,garage-plug
```

Each device will be monitored independently, and the UI will display all devices with their custom names and their charging processes.

## Troubleshooting

### Backend can't connect to MQTT broker
- Check that the MQTT broker is running: `docker-compose logs mosquitto`
- Verify the `MQTT_BROKER_URL` in your `.env` file
- Check firewall settings if using external broker

### No data showing in frontend
- Verify backend is running: `docker-compose logs backend`
- Check backend health through frontend proxy: http://localhost:1818/api/health
- Ensure devices are publishing to the correct MQTT topics

### Frontend can't connect to backend
- Check that both frontend and backend containers are running: `docker-compose ps`
- Check backend health through frontend proxy: http://localhost:1818/api/health
- Check browser console for errors
- Verify both containers are on the same Docker network

## License

ISC

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
