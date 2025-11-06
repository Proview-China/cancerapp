// Test script to debug electron import
console.log('Testing electron import...');
try {
  const electron = require('electron');
  console.log('Electron type:', typeof electron);
  console.log('Electron:', electron);
  console.log('Electron.app:', electron.app);
  console.log('Electron.BrowserWindow:', electron.BrowserWindow);
} catch (error) {
  console.error('Error requiring electron:', error);
}
