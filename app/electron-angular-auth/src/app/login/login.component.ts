import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from '../authentication.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

	constructor(
		private router : Router,
		private authService : AuthenticationService
	) { }

	async ngOnInit() {
		const loggedIn = await this.authService.logIn();
		return this.router.navigate([loggedIn ? '' : '/unauthorized']);
	}
}
