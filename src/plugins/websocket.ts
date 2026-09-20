// src/plugins/websocket.ts
import { WebSocket } from "ws";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

// Хранение активных WebSocket-соединений
const activeConnections = new Map<number, WebSocket>();

export async function websocketHandler(socket: WebSocket, request: any) {
  let userId: number | null = null;

  // Получаем ID пользователя из JWT токена
  try {
    const token = request.headers.cookie?.match(/token=([^;]+)/)?.[1];
    if (token) {
      const decoded = await (request as any).jwtVerify();
      userId = decoded.userId;
    }
  } catch (err) {
    console.error("WebSocket authentication failed:", err);
    socket.close();
    return;
  }

  if (!userId) {
    socket.close();
    return;
  }

  // Сохраняем соединение
  activeConnections.set(userId, socket);

  // Обработка закрытия соединения
  socket.on("close", () => {
    activeConnections.delete(userId!);
  });

  // Обработка получения сообщений (если нужно отправлять сообщения через WebSocket)
  socket.on("message", async (data: any) => {
    const message = data.toString();

    // Здесь можно обрабатывать команды, например, отправку сообщений
    try {
      const parsedMessage = JSON.parse(message);

      if (parsedMessage.type === "send_message") {
        // Обработка отправки сообщения через WebSocket
        // Можно добавить логику проверки и отправки через сервис сообщений
      }
    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
    }
  });
}

// Функция для отправки уведомления о новом сообщении пользователю
export function notifyUserOfNewMessage(userId: number, messageData: any) {
  const connection = activeConnections.get(userId);
  if (connection && connection.readyState === WebSocket.OPEN) {
    connection.send(
      JSON.stringify({
        type: "new_message",
        data: {
          id: messageData.id,
          senderId: messageData.senderId,
          recipientId: messageData.recipientId,
          encryptedContent: messageData.encryptedContent,
          createdAt: messageData.createdAt,
          isRead: messageData.isRead,
        },
      }),
    );
  }
}

// Функция для отправки уведомления о новых непрочитанных сообщениях
export function notifyUserOfUnreadCountChange(userId: number, count: number) {
  const connection = activeConnections.get(userId);
  if (connection && connection.readyState === WebSocket.OPEN) {
    connection.send(
      JSON.stringify({
        type: "unread_count_change",
        count: count,
      }),
    );
  }
}

// Экспортируем функции для использования в других модулях
export { activeConnections };
