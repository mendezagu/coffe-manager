const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    });

    const indexPath = path.join(__dirname, 'dist', 'coffe-manager', 'index.html');
    
    console.log("Cargando archivo HTML desde:", indexPath);
    
    mainWindow.loadFile(indexPath).catch(err => {
        console.error("Error cargando HTML:", err);
    });
});