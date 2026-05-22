import React, { useEffect, useRef } from 'react';
import './css/SystemConsole.css';

/**
 * SystemConsole Component
 * A technical log viewer that displays real-time events from the J.A.R.V.I.S engine.
 */
const SystemConsole = ({ logs, isVisible, isHighlighted }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isVisible) return null;

  return (
    <div className={`system-console ${isHighlighted ? 'tab-highlight-active-nexus' : ''}`}>
      <div className="console-header">
        <span className="console-title">SYSTEM_DIAGNOSTICS</span>
        <div className="console-status">
          <span className="pulse-dot"></span>
          LIVE_FEED
        </div>
      </div>
      <div className="console-body" ref={scrollRef}>
        {logs.length === 0 ? (
          <div className="log-entry system">
            <span className="log-time">[{new Date().toLocaleTimeString()}]</span>
            <span className="log-msg">Waiting for neural uplink...</span>
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className={`log-entry ${log.type}`}>
              <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span className="log-tag">[{log.type.toUpperCase()}]</span>
              <span className="log-msg">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SystemConsole;
