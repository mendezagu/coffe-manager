# CoffeManager

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 16.2.16.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## COMANDOS PARA CORRER EN  DISTINTOS ENTORNOS 

# ng serve --configuration=development (Usa los archivos environment.ts y environmentMongo.ts. No optimiza ni minifica el código.)

# ng serve --configuration=test (Usa environment.test.ts y environmentMongo.test.ts. Mantiene la aplicación sin optimizaciones pero lista para probar con datos de test.)

# ng serve --configuration=production ( Usa environment.prod.ts y environmentMongo.prod.ts. Optimiza y minimiza el código para que cargue más rápido.)



## PARA CORRER Y DEPLOYAR EN GITPAGE: 
LIMPIAR CACHE: ng cache clean
PRIMERO: npm run build,
SEGUNDO: npm run deploy


