# Dark Mode / Light Mode

The Pini Charging Bot application includes a fully functional dark mode and light mode theme system that provides an optimal viewing experience in different lighting conditions.

## Features

### Theme Toggle Button
- Located in the top-right corner of the application header
- Shows a moon icon (🌙) in light mode
- Shows a sun icon (☀️) in dark mode
- Click to instantly switch between themes with smooth transitions

### Persistent Theme Preference
- Your theme selection is automatically saved to browser's localStorage
- Theme preference persists across browser sessions
- The application will load with your previously selected theme

### Comprehensive Color System
The application uses CSS custom properties (variables) for theming, ensuring consistent styling across all components:

#### Light Mode Colors
- Clean, bright interface with white backgrounds
- Purple gradient header (`#667eea` to `#764ba2`)
- Dark text on light backgrounds for optimal readability
- Subtle shadows and borders

#### Dark Mode Colors
- Dark backgrounds (`#1a1a1a`, `#2d2d2d`) that reduce eye strain
- Adjusted purple gradient header for better contrast
- Light text on dark backgrounds
- Enhanced shadows for depth perception
- Adjusted status colors for better visibility in dark environments

### Themed Components
All application components fully support both themes:
- **Header**: Gradient background that adapts to each theme
- **Cards**: Device lists, process lists, and charts
- **Status Badges**: Active/inactive states with theme-appropriate colors
- **Charts**: Data visualizations that work in both modes
- **Modals**: Device label editor and pattern management dialogs
- **Form Controls**: Inputs, buttons, and dropdowns
- **Filters**: Process filtering interface
- **Scrollbars**: Custom styled scrollbars for each theme

## Technical Implementation

### Theme Context
The theme system is implemented using React Context API:
- `ThemeContext.jsx` provides the theme state and toggle function
- `useTheme()` hook for accessing theme in components
- Theme state is synced with `localStorage` for persistence
- `data-theme` attribute on document root controls CSS variables

### CSS Variables
All colors are defined as CSS custom properties in `index.css`:
```css
:root[data-theme="light"] { /* Light theme variables */ }
:root[data-theme="dark"] { /* Dark theme variables */ }
```

Components reference these variables for dynamic theming:
```css
background: var(--bg-secondary);
color: var(--text-primary);
border: 1px solid var(--border-primary);
```

### Smooth Transitions
- Theme changes animate smoothly with CSS transitions
- 0.3s ease transitions on background colors and text colors
- Maintains visual continuity during theme switches

## Usage

### For Users
1. Click the theme toggle button in the top-right corner of the header
2. The interface instantly switches between light and dark modes
3. Your preference is automatically saved

### For Developers
To use the theme in a component:

```jsx
import { useTheme } from './contexts/ThemeContext';

function MyComponent() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
}
```

To style with theme-aware CSS:
```css
.my-element {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

## Screenshots

### Light Mode
![Light Mode](https://github.com/user-attachments/assets/1a779648-0ff9-44a4-a2a5-75475d6f598e)

### Dark Mode
![Dark Mode](https://github.com/user-attachments/assets/4d4a45d7-bf0e-4e40-8964-082cf25fea4a)

## Benefits

- **Reduced Eye Strain**: Dark mode is easier on the eyes in low-light environments
- **Energy Saving**: Dark mode can reduce power consumption on OLED/AMOLED displays
- **User Preference**: Users can choose their preferred viewing mode
- **Accessibility**: Better contrast options for different visual needs
- **Modern UX**: Meets user expectations for contemporary web applications
