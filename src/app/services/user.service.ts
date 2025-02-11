import { Injectable } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
    private authState = new BehaviorSubject<User | null>(null);
    
  constructor(private auth: Auth) {
    onAuthStateChanged(this.auth, (user) => {
        this.authState.next(user);
      });
  }

  register({ email, password }: any) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  login({ email, password }: any) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  loginWithGoogle(){
    return signInWithPopup(this.auth,  new GoogleAuthProvider());
  }

  logout() {
    return signOut(this.auth);
  }

    // Devuelve un observable para detectar si el usuario está logueado
    getAuthState(): Observable<User | null> {
        return this.authState.asObservable();
      }
    
      // Devuelve true si el usuario está autenticado
      isAuthenticated(): boolean {
        return this.authState.value !== null;
      }
}
