const { app, BrowserWindow } = require('electron');

function createWindow () {
  // Crea la ventana del navegador.
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // Carga index.html
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
