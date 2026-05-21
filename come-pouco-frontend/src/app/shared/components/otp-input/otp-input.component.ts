import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-otp-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OtpInputComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtpInputComponent implements ControlValueAccessor {
  readonly length = input(6);
  readonly label = input('Codigo de verificacao');

  @ViewChildren('otpInput')
  private readonly inputElements?: QueryList<ElementRef<HTMLInputElement>>;

  protected readonly values = signal<string[]>(this.emptyValues());
  protected readonly isDisabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected indexes(): number[] {
    return Array.from({ length: this.length() }, (_, index) => index);
  }

  protected valueAt(index: number): string {
    return this.values()[index] || '';
  }

  protected handleInput(event: Event, index: number): void {
    const target = event.target as HTMLInputElement;
    const cleanValue = this.normalize(target.value);

    if (cleanValue.length > 1) {
      this.fillFromText(cleanValue, index);
      return;
    }

    this.setValueAt(index, cleanValue);
    target.value = cleanValue;

    if (cleanValue && index < this.length() - 1) {
      this.focusInput(index + 1);
    }
  }

  protected handleKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.valueAt(index) && index > 0) {
      event.preventDefault();
      this.focusInput(index - 1);
      this.setValueAt(index - 1, '');
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusInput(index - 1);
      return;
    }

    if (event.key === 'ArrowRight' && index < this.length() - 1) {
      event.preventDefault();
      this.focusInput(index + 1);
    }
  }

  protected handlePaste(event: ClipboardEvent, index: number): void {
    const pasted = event.clipboardData?.getData('text') || '';

    if (!pasted.length) {
      return;
    }

    event.preventDefault();
    this.fillFromText(pasted, index);
  }

  protected handleBlur(): void {
    this.onTouched();
  }

  writeValue(value: string | null): void {
    const next = this.emptyValues();
    const normalized = this.normalize(value || '').slice(0, this.length());

    for (const [index, char] of Array.from(normalized).entries()) {
      next[index] = char;
    }

    this.values.set(next);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  private fillFromText(text: string, startIndex: number): void {
    const chars = Array.from(this.normalize(text)).slice(0, this.length() - startIndex);
    const next = [...this.values()];

    for (const [offset, char] of chars.entries()) {
      next[startIndex + offset] = char;
    }

    this.values.set(next.slice(0, this.length()));
    this.emitValue();
    this.focusInput(Math.min(startIndex + chars.length, this.length() - 1));
  }

  private setValueAt(index: number, value: string): void {
    const next = [...this.values()];
    next[index] = value;
    this.values.set(next.slice(0, this.length()));
    this.emitValue();
  }

  private emitValue(): void {
    this.onChange(this.values().join(''));
  }

  private focusInput(index: number): void {
    queueMicrotask(() => this.inputElements?.get(index)?.nativeElement.focus());
  }

  private normalize(value: string): string {
    return value.replace(/[^0-9a-z]/gi, '').toUpperCase();
  }

  private emptyValues(): string[] {
    return Array.from({ length: this.length() }, () => '');
  }
}
