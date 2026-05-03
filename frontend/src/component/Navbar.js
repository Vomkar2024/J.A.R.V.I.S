import React from 'react';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="nav-logo">
        J.A.R.V.I.S
      </div>
      
      <ul className="nav-links">
        <li className="nav-item">
          <a href="#home" className="nav-link">Home</a>
        </li>
        <li className="nav-item">
          <a href="#features" className="nav-link">Core</a>
        </li>
        <li className="nav-item">
          <a href="#nexus" className="nav-link">Nexus</a>
        </li>
        <li className="nav-item">
          <a href="#protocol" className="nav-link">Protocol</a>
        </li>
      </ul>

      <div className="nav-actions">
        <button className="btn-launch">
          Initialize
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
