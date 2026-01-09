# Frontend UI Features

## Page Layout

The application features a modern, gradient-themed responsive design:

### Header
- **Gradient Background**: Purple gradient (from #667eea to #764ba2)
- **Title**: "🔌 Pini Charging Monitor" 
- **Subtitle**: "Real-time monitoring of device charging via MQTT"
- **Responsive**: Adjusts font sizes and padding on mobile devices

### Main Dashboard Grid
Two-column responsive grid layout (stacks to single column on mobile):

#### 1. Connected Devices Section (Left Panel)
- **Device Cards**: Each device shows:
  - Device ID/name
  - Status badge (● ON in green / ○ OFF in gray)
  - Current power consumption in Watts
  - Active process ID (if charging)
- **Hover Effect**: Cards lift and change border color
- **Empty State**: Shows "No devices configured" message

#### 2. Charging Processes Section (Right Panel)
- **Process List**: Scrollable list with:
  - Process ID number
  - Status badge (Active in green / Completed in gray)
  - Device name with 🔌 icon
  - Start timestamp with 🕐 icon
  - Duration with ⏱️ icon
  - Total energy consumed with ⚡ icon (in Wh)
- **Selection**: Click to select process (highlights with blue background)
- **Sorting**: Most recent processes first
- **Scroll**: Custom-styled scrollbar for overflow

### Charging Details Chart (Full-width section when process selected)
Appears below the dashboard grid when a process is selected:

#### Process Information Bar
Displays key details in a horizontal layout:
- Device ID
- Start timestamp
- End timestamp (if completed)
- Status (Active in green / Completed in gray)

#### Statistics Cards
Five gradient cards showing:
1. **Max Power**: Highest wattage recorded (W)
2. **Avg Power**: Average wattage (W)
3. **Min Power**: Lowest wattage recorded (W)
4. **Total Energy**: Cumulative energy consumed (Wh)
5. **Data Points**: Number of measurements recorded

#### Interactive Line Chart
- **Library**: Recharts (responsive React charting library)
- **X-Axis**: Time (formatted as HH:MM:SS)
- **Y-Axis**: Power in Watts with label
- **Line**: Purple (#667eea) with gradient, 2px stroke width
- **Dots**: Visible on data points, larger on hover
- **Tooltip**: Shows exact time and power value on hover
- **Grid**: Light gray dashed grid lines
- **Responsive**: Adjusts to container width

## Color Scheme

- **Primary Gradient**: Purple (#667eea) to Violet (#764ba2)
- **Success/Active**: Green (#28a745)
- **Inactive/Completed**: Gray (#6c757d)
- **Error**: Red (#dc3545)
- **Background**: Light gray (#f5f5f5)
- **Cards**: White with subtle shadow
- **Borders**: Light gray (#e0e0e0), highlight purple on hover

## Responsive Breakpoints

- **Desktop** (>900px): Two-column grid layout
- **Tablet** (600px-900px): Single column, full-width cards
- **Mobile** (<600px): 
  - Smaller header text
  - Stacked process info items
  - Adjusted padding and spacing
  - Two-column stats grid

## Interactive Features

1. **Auto-Refresh**: Fetches new data every 5 seconds
2. **Loading State**: Shows "Loading..." on initial load
3. **Error Handling**: Displays connection errors prominently
4. **Hover Effects**: Cards lift and highlight on mouse over
5. **Click Selection**: Processes highlight when selected
6. **Smooth Transitions**: All state changes animated (0.3s ease)

## User Experience

- **Progressive Disclosure**: Chart only shows when process selected
- **Visual Hierarchy**: Clear section headers with gradient underlines
- **Status Indicators**: Color-coded badges for quick scanning
- **Icons**: Emoji icons for quick visual recognition
- **Whitespace**: Generous padding for readability
- **Shadows**: Subtle depth with shadow effects
