import { NgModule } from '@angular/core';
import { Routes, RouterModule, CanActivate, Router } from '@angular/router';

import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';
import { AuthenticationService } from './authentication.service';

export class AuthGuard implements CanActivate {
	constructor(
		private router      : Router,
		private authService : AuthenticationService
	) { }

	canActivate() {
		if (!this.authService.loggedIn) {
			this.router.navigate(['/login']);
			return false;
		}

		return true;
	}
}


const routes : Routes = [
	{
		path        : '',
		component   : AppComponent,
		canActivate : [AuthGuard]
	},
	{
		path      : 'login',
		component : LoginComponent
	},
	{
		path      : 'unauthorized',
		component : UnauthorizedComponent
	}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule { }
