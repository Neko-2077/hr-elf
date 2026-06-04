/**
 * HR精灵 — Preload 桥接层
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hrelf', {
  checkKey: () => ipcRenderer.invoke('api:check-key'),
  saveKey: (apiKey) => ipcRenderer.invoke('api:save-key', { apiKey }),
  runReview: (data) => ipcRenderer.invoke('api:run-review', data)
});
