import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WaiterDialogComponent } from './waiter-dialog.component';

describe('WaiterDialogComponent', () => {
  let component: WaiterDialogComponent;
  let fixture: ComponentFixture<WaiterDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [WaiterDialogComponent]
    });
    fixture = TestBed.createComponent(WaiterDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
