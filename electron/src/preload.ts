import { ipcRenderer } from 'electron';
import { Subject } from 'rxjs';

declare global {
	interface Window {
		_logIn        : any;
		_$accessToken : Subject<string>;
	}
}
window._logIn        = window._logIn || {};
window._$accessToken = window._$accessToken || new Subject();

process.once('loaded', () => {
	window._$accessToken = new Subject();

	ipcRenderer.on('tokenReceived', (event, token) => {
		window._$accessToken.next(token);
	});

	window._logIn = () => {
		ipcRenderer.send('logIn');
	};
});
