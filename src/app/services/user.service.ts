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
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class UserService {
    private authState = new BehaviorSubject<User | null>(null);
    private roleState = new BehaviorSubject<string | null>(null);
    
  constructor(
    private auth: Auth, 
    private firestore: Firestore
) {

    onAuthStateChanged(this.auth, async (user) => {
        this.authState.next(user);
        if (user) {
          const role = await this.getUserRole(user.uid);
          this.roleState.next(role);
        } else {
          this.roleState.next(null);
        }
      });
  }

  async register({ email, password }: any, role: string = 'user') {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    if (userCredential.user) {
      await this.setUserRole(userCredential.user.uid, role);
    }
    return userCredential;
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

      getRoleState(): Observable<string | null> {
        return this.roleState.asObservable();
      }

      async getUserRole(uid: string): Promise<string | null> {
        const userDocRef = doc(this.firestore, `users/${uid}`);
        const userDoc = await getDoc(userDocRef);
        return userDoc.exists() ? (userDoc.data() as any).role : null;
      }
    
      async setUserRole(uid: string, role: string): Promise<void> {
        console.log(uid,'uuid');
        
        const userDocRef = doc(this.firestore, `users/${uid}`);
        await setDoc(userDocRef, { role }, { merge: true });
      }
}
