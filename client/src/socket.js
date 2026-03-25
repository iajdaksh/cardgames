import { io } from 'socket.io-client';

const getServerUrl = () => {
  if (process.env.REACT_APP_SERVER_URL) {
    return process.env.REACT_APP_SERVER_URL;
  }
  if (window.location.hostname.includes('app.github.dev')) {
    return window.location.origin.replace('-3000.', '-3001.');
  }
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  return window.location.origin;
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
