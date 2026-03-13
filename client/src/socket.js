import { io } from 'socket.io-client';

const getServerUrl = () => {
  if (window.location.hostname.includes('app.github.dev')) {
    return window.location.origin.replace('-3000.', '-3001.');
  }
  return 'http://localhost:3001';
};

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(getServerUrl(), {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      withCredentials: false
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
