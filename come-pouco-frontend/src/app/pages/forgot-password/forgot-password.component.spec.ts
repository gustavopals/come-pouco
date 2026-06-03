import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/services/auth.service';
import { ForgotPasswordComponent } from './forgot-password.component';

type ForgotPasswordHarness = ForgotPasswordComponent & {
  form: ForgotPasswordComponent['form'];
  sentEmail$: ForgotPasswordComponent['sentEmail$'];
  submit(): void;
  useAnotherEmail(): void;
};

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordHarness;
  let authService: { forgotPassword: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      forgotPassword: vi.fn(() =>
        of({ message: 'Se o e-mail estiver cadastrado, enviaremos instrucoes.' }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    })
      .overrideComponent(ForgotPasswordComponent, { set: { template: '' } })
      .compileComponents();

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance as ForgotPasswordHarness;
  });

  it('starts without a sent email so the request form branch can render', async () => {
    expect(await firstValueFrom(component.sentEmail$)).toBe('');
  });

  it('stores the submitted email after a successful request', () => {
    component.form.setValue({ email: 'ana@example.com' });
    component.submit();

    expect(authService.forgotPassword).toHaveBeenCalledWith('ana@example.com');
    expect(component.sentEmail$.value).toBe('ana@example.com');
  });

  it('clears the sent email when the user wants another address', () => {
    component.sentEmail$.next('ana@example.com');
    component.useAnotherEmail();

    expect(component.sentEmail$.value).toBe('');
    expect(component.form.value.email).toBe('');
  });
});
