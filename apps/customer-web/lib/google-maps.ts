import { setOptions } from '@googlemaps/js-api-loader';

let configured = false;

export function configureGoogleMaps(apiKey: string) {
  if (configured) return;
  setOptions({ key: apiKey, v: 'weekly', language: 'en', region: 'IN' });
  configured = true;
}
