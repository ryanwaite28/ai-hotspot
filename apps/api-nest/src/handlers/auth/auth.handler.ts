import type {
  FinishPasskeyAuthenticationInput,
  FinishPasskeyRegistrationInput,
  StartVerificationInput,
  VerificationCallbackInput,
} from '../../../../../packages/contracts/src/index';
import type { AuthService, IdentityVerificationProviderAdapter, RegisterUserInput } from '../../service/auth/auth.service';
import type { PasskeyService } from '../../service/auth/passkey.service.js';
import type { PasskeyVerifierAdapter } from '../../service/auth/passkey-verifier.adapter.js';

export class AuthHandler {
  constructor(
    private readonly authService: AuthService,
    private readonly identityVerificationProvider: IdentityVerificationProviderAdapter,
    private readonly passkeyService: PasskeyService,
    private readonly passkeyVerifier: PasskeyVerifierAdapter,
  ) {}

  async register(body: RegisterUserInput) {
    return this.authService.registerUser(body);
  }

  async verifyEmail(body: { token: string }) {
    return this.authService.verifyEmailToken(body.token);
  }

  async requestEmailReset(body: { email: string }) {
    return this.authService.requestEmailReset(body);
  }

  async updateUserProfile(body: { userId: string; handle?: string; displayName?: string }) {
    return this.authService.updateUserProfile(body);
  }

  async suspendUser(body: { userId: string }) {
    return this.authService.suspendUser(body);
  }

  async flagUserForReview(body: { userId: string; reason: string }) {
    return this.authService.flagUserForReview(body);
  }

  async requestAccountExport(body: { userId: string }) {
    return this.authService.requestAccountExport(body);
  }

  async deactivateAccount(body: { userId: string }) {
    return this.authService.deactivateAccount(body);
  }

  async deleteAccount(body: { userId: string }) {
    return this.authService.deleteAccount(body);
  }

  async startIdentityVerification(body: StartVerificationInput) {
    return this.authService.startIdentityVerification(body, this.identityVerificationProvider);
  }

  async processIdentityVerificationCallback(body: VerificationCallbackInput) {
    return this.authService.processVerificationCallback(body);
  }

  async startPasskeyRegistration(body: { userId: string }) {
    return this.passkeyService.startRegistration(body.userId);
  }

  async finishPasskeyRegistration(body: FinishPasskeyRegistrationInput) {
    return this.passkeyService.finishRegistration(body, this.passkeyVerifier);
  }

  async startPasskeyAuthentication(body: { userId: string }) {
    return this.passkeyService.startAuthentication(body.userId);
  }

  async finishPasskeyAuthentication(body: FinishPasskeyAuthenticationInput) {
    return this.passkeyService.finishAuthentication(body, this.passkeyVerifier);
  }
}
