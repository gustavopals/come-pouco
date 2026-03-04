import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { BehaviorSubject, Subject, catchError, finalize, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

import { COMPANY_ROLE_LABEL } from '../../core/models/company-role.model';
import { User } from '../../core/models/user.model';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-my-company',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    MatTableModule
  ],
  templateUrl: './my-company.component.html',
  styleUrl: './my-company.component.scss'
})
export class MyCompanyComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly refresh$ = new Subject<void>();

  protected readonly displayedColumns = ['id', 'fullName', 'email', 'companyRole', 'createdAt'];
  protected readonly isLoading$ = new BehaviorSubject<boolean>(false);
  protected readonly errorMessage$ = new BehaviorSubject<string | null>(null);

  protected readonly employees$ = this.refresh$.pipe(
    startWith(void 0),
    tap(() => {
      this.isLoading$.next(true);
      this.errorMessage$.next(null);
    }),
    switchMap(() =>
      this.userService.listUsers().pipe(
        map(({ users }) => (Array.isArray(users) ? users.filter((user) => user.role === 'USER') : [])),
        catchError((error) => {
          this.errorMessage$.next(error?.error?.message || 'Nao foi possivel carregar usuarios.');
          return of([] as User[]);
        }),
        finalize(() => this.isLoading$.next(false))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  ngOnInit(): void {}

  protected loadEmployees(): void {
    this.refresh$.next();
  }

  protected companyRoleLabel(user: User): string {
    if (!user.companyRole) {
      return '-';
    }

    return COMPANY_ROLE_LABEL[user.companyRole];
  }
}
