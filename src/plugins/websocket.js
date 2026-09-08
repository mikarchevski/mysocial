import { WebSocket } from 'ws';

export async function websocketHandler(socket: WebSocket, request: any) {
  console.log('WebSocket client connected');
  
  socket.on('message', async (data: any) => {
    const message = data.toString();
    console.log('Received:', message);
    
    // Эхо для теста
    socket.send(`Echo: ${message}`);
  });
  
  socket.on('close', () => {
    console.log('WebSocket client disconnected');
  });
}