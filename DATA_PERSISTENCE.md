# Data Persistence Guide

## Overview

The Pini Charging Bot stores all charging processes, patterns, and user modifications in persistent Docker volumes. This ensures your data survives container restarts and redeployments.

## Storage Location

- **Container Path**: `/app/data`
- **Docker Volume**: `backend-data` (named volume)
- **Files Stored**:
  - `charging-processes.json` - All charging session data
  - `charging-patterns.json` - Recognized device patterns
  - `process-counter.json` - Process ID counter

## Important: Data Persists Across Updates

When you pull the latest changes from GitHub and redeploy, **your data is preserved** as long as you follow the correct update procedure.

## Safe Update Procedure

### Option 1: Using Docker Compose (Recommended)

```bash
# Pull latest code from GitHub
git pull origin main

# Rebuild and restart containers (preserves data volume)
docker-compose up -d --build

# Verify data is intact
docker-compose logs backend | grep "Loaded.*processes"
```

The `backend-data` volume is **NOT** removed during this process.

### Option 2: Manual Docker Commands

```bash
# Pull latest code
git pull origin main

# Stop and remove containers (but NOT volumes)
docker-compose down

# Rebuild images
docker-compose build

# Start containers with existing volume
docker-compose up -d

# Verify data is intact
docker-compose logs backend | grep "Loaded"
```

## ⚠️ What NOT to Do

**DO NOT** run these commands unless you want to delete all data:

```bash
# This removes volumes and will delete all your data!
docker-compose down -v

# This also removes the volume
docker volume rm piniChargingBot_backend-data
```

## Verifying Data Persistence

After redeployment, check the logs to verify your data was loaded:

```bash
docker-compose logs backend | tail -20
```

You should see messages like:
```
Loaded 42 charging processes from storage
Loaded 5 charging patterns from storage
```

If you see `Loaded 0`, your data may have been lost (see recovery below).

## Backup Your Data

To create a backup of your data:

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Copy data from Docker volume
docker cp pini-backend:/app/data/. backups/$(date +%Y%m%d)/

# Or use docker run
docker run --rm -v piniChargingBot_backend-data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/data-$(date +%Y%m%d).tar.gz -C /data .
```

## Restore Data from Backup

If you accidentally lost data:

```bash
# Stop the backend
docker-compose stop backend

# Restore data to volume
docker run --rm -v piniChargingBot_backend-data:/data -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/data-YYYYMMDD.tar.gz -C /data

# Start the backend
docker-compose start backend
```

## Manual Changes Are Preserved

The following manual changes are stored in the data files and will persist:

✅ **Recognized Device Names** - Renamed patterns (e.g., "Hugo" → "Alice's iPhone")
✅ **Process Device Names** - Manually renamed individual charging sessions
✅ **Pattern Associations** - Split patterns and merged patterns
✅ **Process History** - All charging session data and timestamps

## Troubleshooting

### My data disappeared after update

**Possible causes:**
1. Ran `docker-compose down -v` (removes volumes)
2. Deleted the volume manually
3. Changed the volume name in docker-compose.yml

**Solution:**
- Restore from backup (see above)
- Check if volume still exists: `docker volume ls | grep backend-data`

### Volume exists but data not loading

**Check:**
```bash
# Inspect volume
docker volume inspect piniChargingBot_backend-data

# Check files in volume
docker run --rm -v piniChargingBot_backend-data:/data alpine ls -lah /data
```

If files are present but not loading, check backend logs for errors.

### Starting fresh (intentionally)

If you want to clear all data and start fresh:

```bash
# Stop containers and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

## Best Practices

1. **Regular Backups**: Create automated backups of your data volume
2. **Test Updates**: Test updates in a development environment first
3. **Documentation**: Keep track of when you update and what changes were made
4. **Version Control**: Don't modify data files manually; use the UI
5. **Monitoring**: Check logs after updates to ensure data loaded correctly

## Data Volume Details

The named volume `backend-data` is defined in `docker-compose.yml`:

```yaml
volumes:
  backend-data:
    driver: local
```

This creates a persistent volume managed by Docker that survives container recreation.

**Location on host** (varies by OS):
- Linux: `/var/lib/docker/volumes/piniChargingBot_backend-data/_data`
- Docker Desktop (Mac/Windows): Inside Docker VM

## Migration Between Hosts

To move data to a new host:

```bash
# On old host: Create backup
docker run --rm -v piniChargingBot_backend-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/data-migration.tar.gz -C /data .

# Copy data-migration.tar.gz to new host

# On new host: Restore
docker-compose up -d  # Creates volume
docker-compose stop backend
docker run --rm -v piniChargingBot_backend-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/data-migration.tar.gz -C /data
docker-compose start backend
```

## Support

If you encounter data persistence issues:
1. Check this guide first
2. Verify volume exists: `docker volume ls`
3. Check container logs: `docker-compose logs backend`
4. Review backup procedures above
5. Open an issue with logs and steps to reproduce
