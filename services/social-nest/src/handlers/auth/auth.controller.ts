import { Body, ConflictException, Controller, Post } from '@nestjs/common';
import type { RegisterUserInput } from '../../../../../packages/contracts/src';
import { AuthService } from '../../service/auth/auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/internal/v1/auth/register')
  async register(@Body() body: RegisterUserInput): Promise<unknown> {
    try {
      return await this.authService.registerUser(body);
    } catch (error) {
      if (error instanceof Error && error.name === 'DuplicateUserError') {
        throw new ConflictException('A user with this handle or email already exists');
      }
      throw error;
    }
  }

  @Post('/internal/v1/auth/verify-email')
  async verifyEmail(@Body() body: { token: string }): Promise<unknown> {
    return this.authService.verifyEmailToken(body.token);
  }

  @Post('/internal/v1/auth/password-reset/request')
  async requestPasswordReset(@Body() body: { email: string }): Promise<unknown> {
    return this.authService.requestEmailReset(body);
  }
}
