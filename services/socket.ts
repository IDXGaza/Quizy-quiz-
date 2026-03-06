import Ably from 'ably';

const client = new Ably.Realtime('OLeTUQ.nQk18Q:OUUKvXl12udcGg2uD1WesJdp3PB9TIWHeTEl2go7RM4');

type Handler = (...args: any[]) => void;
const handlers: Record<string, Handler[]> = {};

let currentRoomId: string | null = null;
let channel: Ably.RealtimeChannel | null = null;

const getChannel = (roomId: string) => {
  if (channel && currentRoomId === roomId) return channel;
  if (channel) channel.detach();
  currentRoomId = roomId;
  channel = client.channels.get(`buzzer-${roomId}`);
  return channel;
};

export const socket = {
  connected: false,

  on(event: string, handler: Handler) {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(handler);
  },

  off(event: string, handler?: Handler) {
    if (!handler) { handlers[event] = []; return; }
    handlers[event] = (handlers[event] || []).filter(h => h !== handler);
  },

  emit(event: string, ...args: any[]) {
    const roomId = typeof args[0] === 'string' ? args[0] : args[0]?.roomId;
    if (!roomId) return;
    const ch = getChannel(roomId);

    if (event === 'createRoom') {
      ch.subscribe('buzz', (msg) => {
        (handlers['playerBuzzed'] || []).forEach(h => h(msg.data.playerId));
      });
      ch.subscribe('join', (msg) => {
        const player = msg.data.player;
        const existing: any[] = (socket as any)._players || [];
        if (!existing.find((p: any) => p.id === player.id)) existing.push(player);
        (socket as any)._players = existing;
        (handlers['playerJoined'] || []).forEach(h => h(existing));
      });
      ch.subscribe('reset', () => {
        (handlers['buzzerReset'] || []).forEach(h => h());
      });
      socket.connected = true;
      (handlers['connect'] || []).forEach(h => h());
    }

    if (event === 'joinRoom') {
      const player = args[0]?.player;
      ch.subscribe('buzzLocked', (msg) => {
        (handlers['buzzLocked'] || []).forEach(h => h(msg.data.buzzedId));
      });
      ch.subscribe('reset', () => {
        (handlers['buzzerReset'] || []).forEach(h => h());
      });
      ch.publish('join', { player });
      socket.connected = true;
      (handlers['connect'] || []).forEach(h => h());
    }

    if (event === 'buzz') {
      const playerId = args[0]?.playerId;
      ch.publish('buzz', { playerId });
      ch.publish('buzzLocked', { buzzedId: playerId });
    }

    if (event === 'resetBuzzer') {
      ch.publish('reset', {});
    }
  }
};

client.connection.on('connected', () => {
  socket.connected = true;
  (handlers['connect'] || []).forEach(h => h());
});

client.connection.on('disconnected', () => {
  socket.connected = false;
  (handlers['disconnect'] || []).forEach(h => h());
});
