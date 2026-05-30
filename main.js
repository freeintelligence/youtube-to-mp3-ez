const { app, BrowserWindow } = require('electron');
const path = require('path');

// Inicializa el servidor Express
const { startServer } = require('./server.js');

let mainWindow;

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "YouTube Downloader",
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // El servidor Express levanta en el puerto asignado
  mainWindow.loadURL(`http://localhost:${port}`);
  
  // Quita el menú por defecto en Windows/Linux para un aspecto más limpio
  mainWindow.setMenu(null);
}

app.whenReady().then(async () => {
  const { port } = await startServer(3000);
  createWindow(port);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
