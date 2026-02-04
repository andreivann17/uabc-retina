const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
  // Crea la ventana del navegador.
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Ajusta según tus necesidades de seguridad
    },
  });

  // Carga index.html de la app.
  win.loadURL(
    isDev
      ? 'http://localhost:3000' // En desarrollo carga el servidor local
      : `file://${path.join(__dirname, '../build/index.html')}` // En producción, carga el archivo index.html compilado
  );

  // Abre las DevTools si estás en desarrollo.
  if (isDev) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
