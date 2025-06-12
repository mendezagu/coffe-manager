import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { adminPasswordGuard } from './admin-password.guard';

describe('adminPasswordGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => adminPasswordGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
