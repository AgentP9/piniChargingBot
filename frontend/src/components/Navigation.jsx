import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navigation.css';

function Navigation() {
  return (
    <nav className="navigation">
      <NavLink 
        to="/" 
        end
        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
      >
        🔌 Charging
      </NavLink>
      <NavLink 
        to="/devices" 
        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
      >
        📱 Devices
      </NavLink>
    </nav>
  );
}

export default Navigation;
