# Portainer Configuration Guide

This guide explains how to deploy and configure the Pini Charging Monitor using Portainer.

## Prerequisites

- Portainer installed and running
- Access to Portainer web interface
- Git repository URL or local docker-compose.yml file

## Method 1: Deploy from Git Repository (Recommended)

1. **Access Portainer**
   - Navigate to your Portainer instance (e.g., `http://localhost:9000`)
   - Log in with your credentials

2. **Create New Stack**
   - Go to **Stacks** in the left menu
   - Click **+ Add stack**
   - Enter stack name: `pini-charging-monitor`

3. **Configure Repository**
   - Select **Repository** as the build method
   - Enter repository URL: `https://github.com/AgentP9/piniChargingBot`
   - Branch: `main` (or your target branch)
   - Compose path: `docker-compose.yml`

4. **Configure Environment Variables**
   
   In the **Environment variables** section, add or modify:

   | Variable Name | Description | Example Value |
   |--------------|-------------|---------------|
   | `MQTT_BROKER_URL` | MQTT broker connection URL | `mqtt://mosquitto:1883` |
   | `MQTT_USERNAME` | MQTT broker username (optional) | `myuser` |
   | `MQTT_PASSWORD` | MQTT broker password (optional) | `mypassword` |
   | `MQTT_DEVICES` | Comma-separated device IDs | `shellyplug-living-room,shellyplug-garage` |

   **Default values if not specified:**
   - `MQTT_BROKER_URL`: `mqtt://mosquitto:1883` (internal broker)
   - `MQTT_USERNAME`: (empty - no authentication)
   - `MQTT_PASSWORD`: (empty - no authentication)
   - `MQTT_DEVICES`: `shellyplug-s-12345,shellyplug-s-67890`

5. **Deploy Stack**
   - Click **Deploy the stack**
   - Wait for deployment to complete (may take a few minutes for first-time build)

6. **Access Application**
   - Frontend: `http://your-server-ip` (port 80)
   - Backend API: `http://your-server-ip:3000/api/health`
   - MQTT Broker: `your-server-ip:1883`

## Method 2: Deploy from Web Editor

1. **Create New Stack**
   - Go to **Stacks** → **+ Add stack**
   - Enter stack name: `pini-charging-monitor`
   - Select **Web editor**

2. **Paste docker-compose.yml**
   - Copy the entire contents of `docker-compose.yml` from the repository
   - Paste into the web editor

3. **Configure Environment Variables**
   - Scroll down to **Environment variables** section
   - Add variables as described in Method 1, step 4

4. **Deploy**
   - Click **Deploy the stack**

## Method 3: Deploy from Upload

1. **Prepare Files**
   - Download or clone the repository to your local machine
   - Ensure all files are present (docker-compose.yml, backend/, frontend/, mosquitto/)

2. **Upload Stack**
   - Go to **Stacks** → **+ Add stack**
   - Enter stack name: `pini-charging-monitor`
   - Select **Upload**
   - Upload `docker-compose.yml` and related files

3. **Configure and Deploy**
   - Add environment variables
   - Click **Deploy the stack**

## Managing Environment Variables in Portainer

### Viewing Current Configuration

1. Navigate to **Stacks** → `pini-charging-monitor`
2. Click **Editor** tab
3. View current environment variable values

### Updating Configuration

1. **Stop the stack** (optional but recommended):
   - Go to stack details
   - Click **Stop this stack**

2. **Edit environment variables**:
   - Click **Editor** tab
   - Modify environment variables in the editor, OR
   - Use the **Environment variables** section below the editor

3. **Update the stack**:
   - Click **Update the stack**
   - Select **Pull and redeploy** if you want to use latest images

4. **Start the stack** (if stopped):
   - Click **Start this stack**

### Example Configuration Scenarios

#### Using External MQTT Broker

```env
MQTT_BROKER_URL=mqtt://192.168.1.100:1883
MQTT_USERNAME=iot_user
MQTT_PASSWORD=secure_password
MQTT_DEVICES=living-room-plug,bedroom-plug,garage-plug
```

Then in docker-compose.yml, you may want to comment out or remove the mosquitto service since you're using an external broker.

#### Multiple Devices

```env
MQTT_BROKER_URL=mqtt://mosquitto:1883
MQTT_DEVICES=kitchen-plug,office-plug,workshop-plug,garage-ev-charger
```

#### Secure MQTT with TLS

```env
MQTT_BROKER_URL=mqtts://broker.example.com:8883
MQTT_USERNAME=secure_user
MQTT_PASSWORD=secure_password
MQTT_DEVICES=device1,device2
```

## Container Management in Portainer

### Viewing Logs

1. Navigate to **Containers**
2. Click on container name (e.g., `pini-backend`, `pini-frontend`, `pini-mosquitto`)
3. Click **Logs** to view real-time logs
4. Use filters to search for specific events

### Checking Container Status

1. Go to **Containers**
2. View status indicators:
   - Green: Running
   - Red: Stopped
   - Yellow: Starting/Stopping

### Restarting Containers

If you need to restart a specific container:
1. Go to **Containers**
2. Select the container
3. Click **Restart**

Or restart the entire stack:
1. Go to **Stacks** → `pini-charging-monitor`
2. Click **Stop this stack** then **Start this stack**

## Volumes and Persistence

The stack uses the following volumes for data persistence:

- `./mosquitto/config`: MQTT broker configuration
- `./mosquitto/data`: MQTT broker persistent data
- `./mosquitto/log`: MQTT broker logs

To view volumes in Portainer:
1. Navigate to **Volumes**
2. Look for volumes associated with the stack

## Troubleshooting in Portainer

### Backend Can't Connect to MQTT

1. Check backend logs:
   - **Containers** → `pini-backend` → **Logs**
   - Look for "Connected to MQTT broker" or connection errors

2. Verify environment variables:
   - **Stacks** → `pini-charging-monitor` → **Editor**
   - Check `MQTT_BROKER_URL` is correct

3. Check mosquitto container:
   - **Containers** → `pini-mosquitto` → **Logs**
   - Ensure it's running (green status)

### Frontend Not Loading

1. Check frontend container status:
   - **Containers** → `pini-frontend`
   - Ensure status is running (green)

2. View frontend logs:
   - Click `pini-frontend` → **Logs**

3. Test backend API:
   - Open browser: `http://your-server-ip:3000/api/health`
   - Should return JSON with status

### No Data Appearing

1. Check backend logs for MQTT subscriptions:
   - Should see "Subscribed to {device}/relay/0" messages

2. Verify device IDs match exactly:
   - **Stacks** → **Editor** → Check `MQTT_DEVICES`
   - Device IDs are case-sensitive

3. Test MQTT messages:
   - Use `mosquitto_pub` or MQTT Explorer to send test messages
   - See main README for test script usage

## Stack Templates (Optional)

For easier deployment, you can create a Portainer App Template:

1. Go to **Settings** → **App Templates**
2. Add custom template with the repository URL
3. Define environment variables in the template
4. Users can then deploy with one click from **App Templates** menu

### Example Template JSON

```json
{
  "type": 3,
  "title": "Pini Charging Monitor",
  "description": "MQTT-based device charging monitor with real-time visualization",
  "categories": ["IoT", "Monitoring"],
  "platform": "linux",
  "logo": "https://raw.githubusercontent.com/AgentP9/piniChargingBot/main/logo.png",
  "repository": {
    "url": "https://github.com/AgentP9/piniChargingBot",
    "stackfile": "docker-compose.yml"
  },
  "env": [
    {
      "name": "MQTT_BROKER_URL",
      "label": "MQTT Broker URL",
      "default": "mqtt://mosquitto:1883",
      "description": "URL of the MQTT broker (use internal or external)"
    },
    {
      "name": "MQTT_USERNAME",
      "label": "MQTT Username",
      "default": "",
      "description": "MQTT broker username (leave empty if no auth)"
    },
    {
      "name": "MQTT_PASSWORD",
      "label": "MQTT Password",
      "default": "",
      "description": "MQTT broker password (leave empty if no auth)"
    },
    {
      "name": "MQTT_DEVICES",
      "label": "Device IDs",
      "default": "shellyplug-s-12345,shellyplug-s-67890",
      "description": "Comma-separated list of device IDs to monitor"
    }
  ]
}
```

## Security Considerations

When using Portainer:

1. **Access Control**: Use Portainer's RBAC to restrict who can modify the stack
2. **Secrets Management**: Consider using Portainer secrets for sensitive values like MQTT passwords
3. **Network Isolation**: Keep the stack on its own Docker network (already configured)
4. **Environment Variables**: Avoid exposing passwords in logs or UI - use Portainer secrets instead

### Using Portainer Secrets (Advanced)

1. Create secrets:
   - **Secrets** → **+ Add secret**
   - Name: `mqtt_password`
   - Secret: (enter password)

2. Modify docker-compose.yml to use secrets:
   ```yaml
   secrets:
     mqtt_password:
       external: true
   
   services:
     backend:
       secrets:
         - mqtt_password
       environment:
         - MQTT_PASSWORD_FILE=/run/secrets/mqtt_password
   ```

3. Update backend code to read from file if `MQTT_PASSWORD_FILE` is set

## Monitoring and Alerts

Portainer can help monitor the stack:

1. **Container Stats**: View CPU, memory, and network usage
2. **Health Checks**: Monitor container health status
3. **Webhooks**: Set up notifications for container events
4. **Auto-updates**: Configure automatic image updates (use with caution)

## Backup and Restore

### Backup Configuration

1. Export stack:
   - **Stacks** → `pini-charging-monitor` → **Editor**
   - Copy entire configuration
   - Save to file

2. Backup volumes:
   - Use Portainer's volume backup feature, or
   - SSH to host and backup `./mosquitto/data` directory

### Restore

1. Create new stack with saved configuration
2. Restore volume data if needed
3. Deploy stack

## Support

For issues specific to Portainer deployment:
- Check Portainer logs: **Settings** → **Status**
- Consult Portainer documentation: https://docs.portainer.io/
- Review container logs for application-specific errors

For application issues:
- See main README.md
- Check DEPLOYMENT.md
- Review issue tracker on GitHub
