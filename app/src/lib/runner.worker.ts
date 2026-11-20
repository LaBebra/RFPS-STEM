/// <reference lib="webworker" />
/**
 * Ізольоване середовище виконання тест-кейсу.
 * Кожен тест запускається в окремому Web Worker: він не має доступу до DOM,
 * cookie, localStorage застосунку, а головний потік примусово завершує його
 * при перевищенні тайм-ауту (захист від нескінченних циклів).
 */
import { executeTest } from './executor';

declare const self: DedicatedWorkerGlobalScope;

interface RunMessage {
  nonce: string;
  code: string;
  setupCode: string;
}

const post = self.postMessage.bind(self);

// Вимикаємо мережеві та службові API до виконання стороннього коду.
const blocked = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel', 'Worker'];
for (const name of blocked) {
  try {
    Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false });
  } catch {
    /* властивість може бути незмінною в окремих браузерах */
  }
}

self.onmessage = async (event: MessageEvent<RunMessage>) => {
  const { nonce, code, setupCode } = event.data;
  // Після отримання завдання прибираємо обробник, щоб код тесту не зміг його перехопити.
  self.onmessage = null;
  const outcome = await executeTest(code, setupCode);
  post({ nonce, outcome });
};
