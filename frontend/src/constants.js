/**
 * J.A.R.V.I.S Frontend Constants
 * Centralized system configuration for better maintainability.
 */

export const SYSTEM_NAME = 'J.A.R.V.I.S';
export const VERSION = '3.0.0';

// Timing Constants
export const SPLASH_DURATION = 9200;
export const FADE_DURATION = 800;
export const HERO_TIMEOUT = 5000;

// UI Strings
export const STATUS_LABELS = {
  THINKING: 'NEURAL_PROCESSING',
  SPEAKING: 'VOICE_OUTPUT',
  IDLE: 'STABLE_CONNECTION',
  OBSERVING: 'VISION_ACTIVE',
  MEMORY: 'MEMORY_ACCESS',
  TOOL: 'EXECUTING_TASK'
};

export const ALERTS = {
  LINK_ESTABLISHED: 'Neural Link Established',
  LINK_FAILED: 'Neural Link Failed: Check Permissions',
  MEMORY_UPDATED: 'Memory Updated',
  SETTINGS_RESET: 'All settings are reset'
};

// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
