import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSingleMapListener } from '../src/lib/mapLifecycle.js';

function mockMap() {
  const listeners = new Map();
  return {
    on(event, handler) {
      const handlers = listeners.get(event) || [];
      handlers.push(handler);
      listeners.set(event, handlers);
    },
    off(event, handler) {
      listeners.set(event, (listeners.get(event) || []).filter(item => item !== handler));
    },
    emit(event) {
      for (const handler of listeners.get(event) || []) handler();
    },
    listenerCount(event) { return (listeners.get(event) || []).length; },
  };
}

test('style restoration runs after every style load without duplicate registration', () => {
  const map = mockMap();
  let restorations = 0;
  const restore = () => { restorations += 1; };

  const dispose = registerSingleMapListener(map, 'style.load', restore);
  registerSingleMapListener(map, 'style.load', restore);
  assert.equal(map.listenerCount('style.load'), 1);

  map.emit('style.load');
  map.emit('style.load');
  assert.equal(restorations, 2);

  dispose();
  assert.equal(map.listenerCount('style.load'), 0);
});
