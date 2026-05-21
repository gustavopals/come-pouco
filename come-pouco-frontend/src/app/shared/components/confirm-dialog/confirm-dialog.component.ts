import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { IconComponent } from '../icon/icon.component';

export type ConfirmDialogTone = 'danger' | 'warning' | 'info';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmDialogTone;
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, IconComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<ConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) protected readonly data: ConfirmDialogData,
  ) {}

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  protected tone(): ConfirmDialogTone {
    return this.data.tone || 'danger';
  }

  protected icon(): string {
    if (this.data.icon) {
      return this.data.icon;
    }

    const icons: Record<ConfirmDialogTone, string> = {
      danger: 'triangle-alert',
      warning: 'circle-alert',
      info: 'info',
    };

    return icons[this.tone()];
  }
}
