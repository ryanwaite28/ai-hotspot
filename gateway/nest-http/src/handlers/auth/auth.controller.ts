import { Body, ConflictException, Controller, Post } from '@nestjs/common';
import type { RegisterUserInput } from '../../../../../packages/contracts/src';
import { AuthServiceClient } from '../../clients/auth-service.client';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthServiceClient) {}

  @Post('/auth/register')
  async register(@Body() body: RegisterUserInput): Promise<unknown> {
    try {
      return await this.authService.register(body);
    } catch (error) {
      if (error instanceof Error && error.name === 'DuplicateUserError') {
        throw new ConflictException('A user with this handle or email already exists');
      }
      throw error;
    }
  }

  @Post('/auth/verify-email')
  async verifyEmail(@Body() body: { token: string }): Promise<unknown> {
    return this.authService.verifyEmail(body.token);
  }

  @Post('/auth/password-reset/request')
  async requestPasswordReset(@Body() body: { email: string }): Promise<unknown> {
    return this.authService.requestPasswordReset(body.email);
  }
}
