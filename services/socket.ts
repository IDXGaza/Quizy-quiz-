import { io } from "socket.io-client";

const socketUrl = process.env.SHARED_APP_URL || window.location.origin;
export const socket = io(socketUrl);
