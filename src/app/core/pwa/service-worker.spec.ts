import { isServiceWorkerEnabled } from './service-worker';

describe('isServiceWorkerEnabled', () => {
  it('should register the worker in a production build', () => {
    expect(isServiceWorkerEnabled({ mode: 'production', production: true })).toBe(true);
  });

  it('should not register the worker in a development build', () => {
    expect(isServiceWorkerEnabled({ mode: 'dev', production: false })).toBe(false);
  });

  it('should never register the worker while tests run, even with a production environment', () => {
    expect(isServiceWorkerEnabled({ mode: 'test', production: true })).toBe(false);
  });
});
