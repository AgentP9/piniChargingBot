#!/bin/bash

# Manual API Testing Script for Recognition Service
# This script tests the new endpoints for pattern rerun and process renaming

API_URL="${API_URL:-http://localhost:3000}"

echo "==============================================="
echo "Recognition Service API Testing"
echo "==============================================="
echo "API URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "  Method: $method"
    echo "  Endpoint: $endpoint"
    
    if [ -n "$data" ]; then
        echo "  Data: $data"
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "  ${GREEN}✓ Success (HTTP $http_code)${NC}"
        echo "  Response: $body" | head -c 200
        echo ""
    else
        echo -e "  ${RED}✗ Failed (HTTP $http_code)${NC}"
        echo "  Response: $body"
    fi
    echo ""
}

echo "1. Testing Pattern Rerun Endpoint"
echo "-----------------------------------"
test_endpoint "POST" "/api/patterns/rerun" "" "Rerun pattern recognition"

echo "2. Testing Process List Endpoint"
echo "-----------------------------------"
test_endpoint "GET" "/api/processes" "" "Get all processes"

echo "3. Testing Pattern List Endpoint"
echo "-----------------------------------"
test_endpoint "GET" "/api/patterns" "" "Get all patterns"

echo "4. Testing Individual Process Rename"
echo "-------------------------------------"
echo "Note: This test requires a valid process ID."
echo "You can get a process ID from the /api/processes endpoint above."
echo ""
read -p "Enter a process ID to test rename (or press Enter to skip): " PROCESS_ID

if [ -n "$PROCESS_ID" ]; then
    read -p "Enter new device name: " NEW_NAME
    
    test_endpoint "PUT" "/api/processes/$PROCESS_ID/device-name" \
        "{\"newDeviceName\": \"$NEW_NAME\"}" \
        "Rename process $PROCESS_ID to '$NEW_NAME'"
fi

echo "5. Testing Pattern Label Update"
echo "--------------------------------"
echo "Note: This test requires a valid pattern ID."
echo "You can get a pattern ID from the /api/patterns endpoint above."
echo ""
read -p "Enter a pattern ID to test rename (or press Enter to skip): " PATTERN_ID

if [ -n "$PATTERN_ID" ]; then
    read -p "Enter new device label: " NEW_LABEL
    read -p "Rename all processes? (true/false): " RENAME_ALL
    
    test_endpoint "PUT" "/api/patterns/$PATTERN_ID/label" \
        "{\"newLabel\": \"$NEW_LABEL\", \"shouldRenameAll\": $RENAME_ALL}" \
        "Update pattern $PATTERN_ID label to '$NEW_LABEL'"
fi

echo "==============================================="
echo "Testing Complete"
echo "==============================================="
echo ""
echo "For comprehensive testing, use the web interface at:"
echo "$API_URL (assuming frontend is served from same host)"
