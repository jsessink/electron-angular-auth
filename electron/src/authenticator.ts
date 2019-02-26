import { ipcMain, BrowserWindow, session } from 'electron';
import * as request from 'request';
import * as crypto from 'crypto';
import { throwError } from 'rxjs';

import { ExpressApp } from './express';
import * as config from './config.json';


// State and PKCE verifiers.
const authStateIdentifier = Math.random().toString(36).substring(7);

function base64URLEncode(str) {
	return str.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
}
const authPKCEVerifier = base64URLEncode(crypto.randomBytes(32));

function sha256(buffer) {
	return crypto.createHash('sha256').update(buffer).digest();
}
const authPKCEChallenge = base64URLEncode(sha256(authPKCEVerifier));


export class Authenticator {
	private expressApp : ExpressApp;
	private authWindow : BrowserWindow;

	constructor() {
		this.checkAuth();
	}

	private async checkAuth() {
		await this.initializeAuthWindow();
		// const refreshToken = await this.getRefreshTokenFromStorage();
		const refreshToken = null;

		if (refreshToken) {
			// Stop the server and close the auth window since we no longer need it for authentication
			this.authWindow.close();
			this.expressApp.stop();
			this.refreshAccessToken(refreshToken);
		} else {
			// Show the auth window since we need to have the user see it to authenticate
			this.authWindow.show();
			this.authenticate();
		}
	}
	
	public initIPCWatchers(mainWindow) {
		ipcMain.on('login', () => {
			this.authenticate();
		});

		ipcMain.on('refreshAccessToken', (event, refreshToken) => {
			const tokenRequestUrl = `https://login.microsoftonline.com/${config.auth.tenantId}/oauth2/v2.0/token`;

			// No PKCE code_verifier here, as the refresh has its own grant flow.
			const tokenRequestBody = {
				grant_type    : 'refresh_token',
				client_id     : config.auth.clientId,
				refresh_token : refreshToken,
				scope         : config.auth.scope
			};

			request.post(
				{ url: tokenRequestUrl, form: tokenRequestBody },
				(err, httpResponse, body) => {
					mainWindow.webContents.send('tokenReceived', body);
				}
			);
		});

		ipcMain.on('routeToHome', () => {
			mainWindow.loadURL(`file://${__dirname}/index.html`);
		});

		ipcMain.on('logout', () => {
			// Maybe check if we need to sync data first?
			mainWindow.close();
		});
	}


	private async initializeAuthWindow() : Promise<void> {
		this.expressApp = new ExpressApp();
		await this.expressApp.start();

		this.authWindow = new BrowserWindow(
			{
				show : false,
				alwaysOnTop : true,
				webPreferences : {
					nodeIntegration  : false,
					contextIsolation : true
				}
			}
		);

		this.authWindow.loadURL(`http://${config.express.protocol}:${config.express.port}`);

		this.authWindow.on('closed', () => {
			this.authWindow = null;
		});
	}


	/**
	 * Authenticates a user to the service and grants an access_token for the specified scope.
	 */
	private async authenticate() : Promise<void> {
		this.authWindow.loadURL(`
			https://login.microsoftonline.com/${config.auth.tenantId}/oauth2/v2.0/authorize?
				client_id=${config.auth.clientId}
				&response_type=code
				&redirect_uri=http://${config.express.protocol}:${config.express.port}
				&response_mode=query
				&scope=${config.auth.scope}
				&state=${authStateIdentifier}
				&code_challenge_method=S256
				&code_challenge=${authPKCEChallenge}
		`);

		this.authWindow.webContents.on('did-finish-load', () => {
			session.defaultSession.webRequest.onCompleted({ urls: [`http://${config.express.protocol}:${config.express.port}/?code=` + '*'] }, details => {
				const _url        = details.url.split('?')[1]; // get the equivalent of window.location.search for the URLSearchParams to work properly
				const _params     = new URLSearchParams(_url);
				const _accessCode = _params.get('code');
				const _state      = _params.get('state');

				// Ensure our original State identifier that we created matches the returned state value in the response.
				if (_accessCode && _state === authStateIdentifier) {
					const tokenRequestUrl = `https://login.microsoftonline.com/${config.auth.tenantId}/oauth2/v2.0/token`;

					const tokenRequestBody = {
						grant_type    : 'authorization_code',
						client_id     : config.auth.clientId,
						code          : _accessCode,
						redirect_uri  : `http://${config.express.protocol}:${config.express.port}`,
						scope         : config.auth.scope,
						code_verifier : authPKCEVerifier
					};

					request.post(
						{ url: tokenRequestUrl, form: tokenRequestBody },
						(err, httpResponse, body) => {
							console.log(body);
							this.authWindow.loadURL(`http://${config.express.protocol}:${config.express.port}`);
							this.handleAccessTokenResponse(err, httpResponse, body);
							this.authWindow.close();
							this.expressApp.stop();
						}
					);
				}
			});
		});
	}


	private handleAccessTokenResponse(err, httpResponse, body) : string {
		if (!err) {
			try {
				const response = JSON.parse(body);

				if (response.error) {
					throwError('Error: ' + response.error + '\nFailure during the request of the access_token\n' + response.error_description);
				} else {
					this.storeRefreshToken(response.refresh_token);
					return response;
				}
			} catch {
				throwError('Could not parse and store Refresh Token.');
			}
		} else {
			throwError('Error: ' + httpResponse + '\nFailure during the request of the access_token\n' + body);
		}
	}


	private storeRefreshToken(token) {
		const cookie = {
			url      : 'http://${config.express.protocol}:${config.express.port}',
			name     : 'refresh_token',
			value    : JSON.stringify(token),
			httpOnly : true,
			expirationDate: Math.floor(new Date().getTime() / 1000) + (60 * 60 * 24 * 90) // setting to +90 days
		};

		session.defaultSession.cookies.set(cookie, error => error ? console.error(error) : null);
	}


	private getRefreshTokenFromStorage() : Promise<null | string> {
		const cookie = {
			url  : 'http://${config.express.protocol}:${config.express.port}',
			name : 'refresh_token'
		};

		return new Promise(resolve => {
			session.defaultSession.cookies.get(cookie, (error, refreshTokenCookie) => {
				if (error) {
					return resolve();
				} else if (!refreshTokenCookie.length) {
					return resolve();
				} else {
					return resolve(JSON.parse(refreshTokenCookie[0].value));
				}
			});
		});
	}


	public refreshAccessToken(refreshToken) {
		const tokenRequestUrl = `https://login.microsoftonline.com/${config.auth.tenantId}/oauth2/v2.0/token`;

		// No PKCE code_verifier here, as the refresh has its own grant flow.
		const tokenRequestBody = {
			grant_type    : 'refresh_token',
			client_id     : config.auth.clientId,
			refresh_token : refreshToken,
			scope         : config.auth.scope
		};

		request.post(
			{ url: tokenRequestUrl, formData: tokenRequestBody },
			(err, httpResponse, body) => this.handleAccessTokenResponse(err, httpResponse, body)
		);
	}


	public async logout() {
		const cookie = {
			url  : 'http://${config.express.protocol}:${config.express.port}',
			name : 'refresh_token'
		};

		await this.initializeAuthWindow();

		session.defaultSession.cookies.remove(cookie.url, cookie.name, () => {
			this.authWindow.show();
			this.authWindow.loadURL('https://login.microsoftonline.com/common/oauth2/v2.0/logout');
			this.authWindow.webContents.on('did-finish-load', () => {
				this.authWindow.close();
				this.expressApp.stop();
			});
		});
	}
}
