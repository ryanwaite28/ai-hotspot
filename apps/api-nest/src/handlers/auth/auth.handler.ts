import type { AuthService, RegisterUserInput } from '../../service/auth/auth.service';

export class AuthHandler {
  constructor(private readonly authService: AuthService) {}

  async register(body: RegisterUserInput) {
    return this.authService.registerUser(body);
  }
}
