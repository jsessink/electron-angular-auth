import * as express from 'express';
import * as config from './config.json';

export class ExpressApp {
	private app;
	private appServer;

	constructor() {
		this.app = express();
	}


	/**
	 * Starts a new express server and displays "Logging In" (should not be seen more than a few milliseconds).
	 * Async, since we need to wait on the server to be ready, so we wrap in a promise and resolve it once it loads.
	 */
	public start() : Promise<null> {
		return new Promise(resolve => {
			this.app.get('*', (req, res) => res.send('Logging In!'));

			this.appServer = this.app.listen(config.express.port, () => {
				console.log(`\nExpress app listening on port ${config.express.port}!\n`);
				return resolve();
			});
		});
	}


	/**
	 * Stops the express server
	 */
	public stop() {
		this.appServer.close();
	}
}
