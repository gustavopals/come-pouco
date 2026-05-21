import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PublicConvertPayload, PublicConvertResponse } from '../models/public-landing.model';

@Injectable({ providedIn: 'root' })
export class PublicConvertService {
  constructor(private readonly http: HttpClient) {}

  convert(payload: PublicConvertPayload): Observable<PublicConvertResponse> {
    return this.http.post<PublicConvertResponse>(`${environment.apiUrl}/public/convert`, payload);
  }
}
