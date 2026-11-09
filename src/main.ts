import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';

import './styles/styles.css';

bootstrapApplication(AppComponent, appConfig).catch((error) => console.error(error));
