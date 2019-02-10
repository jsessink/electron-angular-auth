import { app, BrowserWindow, Menu, MenuItem } from 'electron';

import { Authenticator } from './authenticator';


class Electron {
	private authenticator : Authenticator;

	constructor() {
		this.authenticator = new Authenticator();
		this.initialize();
	}


	/**
	 * Load up our main window for the web application.
	 */
	private initialize() {
		const menu = new Menu();
		menu.append(
			new MenuItem({
				label: 'Log Out',
				click:() => this.authenticator.logout()
			})
		);
		Menu.setApplicationMenu(menu);

		// Create the browser window.
		let mainWindow = new BrowserWindow(
			{
				width: 800,
				height: 600,
				webPreferences: {
					nodeIntegration: false, // you don't need to add this in Electron v4+ as it is default
					contextIsolation: false
				}
			}
		);

		// and load the index.html of the app.
		mainWindow.loadFile(`${__dirname}/../../app/electron-angular-auth/dist/electron-angular-auth/index.html`);

		// Watch for IPC changes.
		this.authenticator.initIPCWatchers(mainWindow);
	}
}

app.on('ready', () => new Electron());
