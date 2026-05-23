import React, { useState, useEffect, useRef, useCallback } from 'react';
import './css/NexusVault.css';

// Dynamic API URL resolver matching the resilience protocol
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/+$/, '');
  }
  const protocol = window.location.protocol;
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:8000`;
};

// Premium custom SVG Icons
const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const UnlockIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const DocumentIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

const ShredIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

function NexusVault() {
  const [password, setPassword] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef(null);
  const apiUrl = getApiUrl();

  // 1. Check if the vault has been initialized
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/nexus/status`);
      if (res.ok) {
        const data = await res.json();
        setIsInitialized(data.initialized);
      }
    } catch (e) {
      console.error("[Vault] Status check failed:", e);
      setError("Unable to connect to J.A.R.V.I.S Neural Core.");
    }
  }, [apiUrl]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // 2. Initialize vault with a new password
  const handleInitialize = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError("Credential key must be at least 6 characters long.");
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/nexus/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        setIsInitialized(true);
        setIsLocked(false);
        setFiles([]);
      } else {
        const data = await res.json();
        setError(data.detail || "Initialization failed.");
      }
    } catch (err) {
      setError("Connection to Neural Core lost.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Unlock vault with password
  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!password) return;
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/nexus/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
        setIsLocked(false);
      } else {
        const data = await res.json();
        setError(data.detail || "Invalid credentials. Access Denied.");
      }
    } catch (err) {
      setError("Authentication handshake timed out.");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Lock vault (wipe in-memory password)
  const handleLock = () => {
    setPassword('');
    setFiles([]);
    setIsLocked(true);
    setError('');
  };

  // Helper to load file list
  const refreshFiles = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/nexus/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to sync files list:", err);
    }
  }, [apiUrl, password]);

  // 5. Encrypt and upload a file
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', password);

      const res = await fetch(`${apiUrl}/api/nexus/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        await refreshFiles();
      } else {
        const data = await res.json();
        setError(data.detail || "File encryption protocol failed.");
      }
    } catch (err) {
      setError("Network interruption during transmission.");
    } finally {
      setIsLoading(false);
    }
  };

  // File explorer interactions
  const onFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // 6. Decrypt and download
  const handleDownload = async (fileUuid) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/nexus/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, uuid: fileUuid })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Extract original name from headers or default safely
        const disposition = res.headers.get('Content-Disposition');
        let filename = 'decrypted_file';
        if (disposition && disposition.indexOf('filename=') !== -1) {
          const matches = /filename="([^"]+)"/.exec(disposition);
          if (matches != null && matches[1]) {
            filename = matches[1];
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        setError(data.detail || "Decryption signature check failed.");
      }
    } catch (err) {
      setError("Download pipeline severed.");
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Shred / Delete file
  const handleDelete = async (fileUuid) => {
    if (!window.confirm("Are you certain you wish to shred this file from storage? This operation physically overwrites the bytes and is completely irreversible, sir.")) {
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/nexus/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, uuid: fileUuid })
      });
      if (res.ok) {
        await refreshFiles();
      } else {
        const data = await res.json();
        setError(data.detail || "Shred operation failed.");
      }
    } catch (err) {
      setError("Failed to transmit delete signature.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to format bytes
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format date nicely
  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // --- RENDERS ---

  // Screen 1: Uninitialized (Set master key)
  if (!isInitialized) {
    return (
      <div className="nexus-vault-container">
        <div className="vault-lock-screen">
          <div className="vault-lock-icon-container">
            <div className="vault-dial-ring"></div>
            <div className="vault-dial-ring-inner"></div>
            <div className="vault-lock-core"><LockIcon /></div>
          </div>
          <h2>Initialize Nexus Vault</h2>
          <p>
            Secure cryptographic storage has not yet been established. Define a master security key to encrypt your personal vault index using AES-256-GCM.
          </p>
          
          <form className="vault-auth-form" onSubmit={handleInitialize}>
            <div className="vault-input-wrapper">
              <input
                type="password"
                placeholder="SET VAULT ACCESS PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <button className="vault-btn-submit" type="submit" disabled={isLoading}>
              {isLoading ? "PROVISIONING..." : "INITIALIZE SECURITY CORE"}
            </button>
            {error && <div className="vault-error-msg">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  // Screen 2: Locked State (Prompt for password)
  if (isLocked) {
    return (
      <div className="nexus-vault-container">
        <div className="vault-lock-screen">
          <div className="vault-lock-icon-container">
            <div className="vault-dial-ring"></div>
            <div className="vault-dial-ring-inner"></div>
            <div className="vault-lock-core"><LockIcon /></div>
          </div>
          <h2>Nexus Data Storage Locked</h2>
          <p>
            Sir, all stored documents, credentials, and custom datasets are encrypted inside the zero-knowledge vault. Please provide your master credentials.
          </p>
          
          <form className="vault-auth-form" onSubmit={handleUnlock}>
            <div className="vault-input-wrapper">
              <input
                type="password"
                placeholder="ENTER MASTER CREDENTIALS"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>
            <button className="vault-btn-submit" type="submit" disabled={isLoading}>
              {isLoading ? "AUTHORIZING..." : "DECRYPT SECURE CORE"}
            </button>
            {error && <div className="vault-error-msg">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  // Screen 3: Unlocked Dashboard
  return (
    <div className="nexus-vault-container">
      <div className="vault-header">
        <div className="vault-header-title">
          <h2>Nexus Secure Storage</h2>
          <div className="vault-telemetry-meta">
            <span className="secure-badge green">
              <ShieldIcon /> AES-256-GCM nominal
            </span>
            <span className="secure-badge orange">
              <UnlockIcon /> Vault Unlocked
            </span>
          </div>
        </div>
        <button className="vault-btn-lock" onClick={handleLock} disabled={isLoading}>
          LOCK VAULT
        </button>
      </div>

      {error && <div className="vault-error-msg" style={{ marginBottom: '1.25rem', textAlign: 'center' }}>{error}</div>}

      <div className="vault-layout">
        {/* Left column: Controls & Stats */}
        <div className="vault-sidebar">
          {/* File Upload zone */}
          <div 
            className={`encrypt-dropzone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={onFileChange} 
            />
            <div className="dropzone-icon">
              <UploadIcon />
            </div>
            <p>ENCRYPT & UPLOAD</p>
            <div className="dropzone-sub">Drag files here or click to browse</div>
          </div>

          {/* Cryptographic telemetry */}
          <div className="crypto-monitor-card">
            <div className="crypto-monitor-title">Cipher Metrics</div>
            <div className="crypto-monitor-stat">
              <span>Standard:</span>
              <span className="crypto-monitor-val">AES-GCM-256</span>
            </div>
            <div className="crypto-monitor-stat">
              <span>Key Derivation:</span>
              <span className="crypto-monitor-val">PBKDF2-SHA256</span>
            </div>
            <div className="crypto-monitor-stat">
              <span>Iterations:</span>
              <span className="crypto-monitor-val">100,000</span>
            </div>
            <div className="crypto-monitor-stat">
              <span>Entropy Block:</span>
              <span className="crypto-monitor-val">IV (12B) + SALT (16B)</span>
            </div>
            <div className="crypto-monitor-stat">
              <span>Client State:</span>
              <span className="crypto-monitor-val" style={{ color: '#00ffcc' }}>In-Memory Cache</span>
            </div>
          </div>
        </div>

        {/* Right column: Decrypted Index and File Explorer */}
        <div className="vault-file-explorer">
          <div className="vault-explorer-header">
            <h3>SECURE VAULT REGISTRY</h3>
            <span className="vault-file-counter">{files.length} FILES</span>
          </div>

          <div className="explorer-scroll-container">
            {files.length === 0 ? (
              <div className="vault-empty-state">
                <div className="empty-vault-icon">
                  <ShieldIcon />
                </div>
                <p>Vault is completely empty, sir.</p>
                <span>Upload sensitive files to secure them with military-grade encryption.</span>
              </div>
            ) : (
              <table className="vault-table">
                <thead>
                  <tr>
                    <th>FILE NAME</th>
                    <th>SIZE</th>
                    <th>ENCRYPTED ON</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.uuid} className="vault-file-row">
                      <td>
                        <div className="file-name-wrapper" title={file.name}>
                          <span className="file-icon"><DocumentIcon /></span>
                          {file.name}
                        </div>
                      </td>
                      <td className="file-meta-cell">{formatBytes(file.size)}</td>
                      <td className="file-meta-cell">{formatDate(file.createdAt)}</td>
                      <td>
                        <div className="file-actions-cell">
                          <button 
                            className="vault-action-btn download" 
                            title="Decrypt and Download"
                            onClick={() => handleDownload(file.uuid)}
                            disabled={isLoading}
                          >
                            <DownloadIcon />
                          </button>
                          <button 
                            className="vault-action-btn delete" 
                            title="Secure Shred / Delete"
                            onClick={() => handleDelete(file.uuid)}
                            disabled={isLoading}
                          >
                            <ShredIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NexusVault;
