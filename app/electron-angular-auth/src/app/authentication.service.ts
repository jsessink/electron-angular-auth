import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ICustomWindow extends Window {
	_logIn        : any;
	_$accessToken : Subject<string>;
}

function _window() : any {
	// return the global native browser window object
	return window;
}

@Injectable()
export class WindowRef {
	get nativeWindow() : ICustomWindow {
		return _window();
	}
}


@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
	private window   : ICustomWindow;
	public  loggedIn : boolean;

	constructor(private windowRef : WindowRef) {
		this.window = this.windowRef.nativeWindow;
	}

	public async logIn() : Promise<boolean> {
		this.window._logIn();

		return new Promise(resolve => {
			this.window._$accessToken.subscribe(token => resolve(token ? true : false));
		});
	}
}
