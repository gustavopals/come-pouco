import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { captureFrontendException, initFrontendSentry } from './app/core/monitoring/sentry';

initFrontendSentry();
bootstrapApplication(App, appConfig).catch((err) => {
  captureFrontendException(err, { eventType: 'angular_bootstrap_failed' });
  throw err;
});
