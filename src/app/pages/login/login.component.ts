import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit{
    formLogin: FormGroup; 

    constructor(
        private userService: UserService,
        private router: Router
      ){
    
        this.formLogin = new FormGroup({
          email: new FormControl(),
          password: new FormControl()
        })
      }

      ngOnInit(): void {
      
      }
    
      onSubmit(){
         this.userService.login(this.formLogin.value)
         .then(response =>{
          console.log(response,'respuesta');
          this.router.navigate([''])
          
    
         }).catch(error=>{
          console.log(error,'este es el error');
          
         })
      }

      loginWithGoogle(){
        this.userService.loginWithGoogle()
        .then(()=>{
          this.router.navigate(['/home'])
        })
        .then(error=> console.log(error))
      }

}
