import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { IconButtonComponent } from '../icon-button/icon-button.component';

export type CrudDrawerMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-crud-drawer',
  standalone: true,
  imports: [
    CommonModule,
    A11yModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    IconButtonComponent,
  ],
  templateUrl: './crud-drawer.component.html',
  styleUrl: './crud-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrudDrawerComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly mode = input<CrudDrawerMode>('create');
  readonly saving = input(false);
  readonly canSubmit = input(true);
  readonly submitLabel = input<string | null>(null);
  readonly cancelLabel = input<string>('Cancelar');
  readonly width = input<string>('480px');
  readonly hideDefaultFooter = input(false);

  readonly closed = output<void>();
  readonly submitted = output<void>();

  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;

  protected readonly resolvedSubmitLabel = computed(() => {
    const custom = this.submitLabel();
    if (custom !== null) {
      return custom;
    }

    if (this.mode() === 'edit') {
      return 'Salvar alterações';
    }

    return 'Criar';
  });

  protected readonly showFooter = computed(
    () => !this.hideDefaultFooter() && this.mode() !== 'view',
  );

  constructor() {
    effect(() => {
      if (typeof document === 'undefined') {
        return;
      }

      const isOpen = this.open();
      document.body.classList.toggle('cp-drawer-open', isOpen);
    });
  }

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    if (this.open() && !this.saving()) {
      this.closed.emit();
    }
  }

  protected handleBackdropClick(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  protected handleSubmit(): void {
    if (this.canSubmit() && !this.saving()) {
      this.submitted.emit();
    }
  }

  protected handleClose(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }
}
