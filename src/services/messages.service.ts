// src/services/messages.service.ts
import MessagesRepository from '../repositories/messages.repository.js';
import UsersRepository from '../repositories/users.repository.js';

export default class MessagesService {
  private messagesRepo = new MessagesRepository();
  private usersRepo = new UsersRepository();

  async getUnreadDialogsCount(userId: number) {
    return await this.messagesRepo.getUnreadDialogsCount(userId);
  }

  async getDialogs(userId: number, filter: string = 'all') {
    const allMessages = await this.messagesRepo.findByUserId(userId);
    
    const dialogsMap = new Map();
    
    for (const msg of allMessages) {
      const partnerId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      
      if (!dialogsMap.has(partnerId)) {
        const partner = await this.usersRepo.findById(partnerId);
        
        if (!partner) continue;
        
        dialogsMap.set(partnerId, {
          partnerId: partner.id,
          firstName: partner.firstName,
          lastName: partner.lastName,
          lastMessage: msg.encryptedContent,
          lastMessageAt: msg.createdAt,
          isRead: msg.isRead,
          unreadCount: 0,
        });
      }
      
      if (msg.senderId === partnerId && !msg.isRead) {
        const dialog = dialogsMap.get(partnerId);
        dialog.unreadCount++;
      }
    }

    let dialogs = Array.from(dialogsMap.values());

    if (filter === 'unread') {
      dialogs = dialogs.filter(d => d.unreadCount > 0);
    }

    return dialogs;
  }

  async getDialogMessages(currentUserId: number, partnerId: number) {
    const messages = await this.messagesRepo.findBetweenUsers(currentUserId, partnerId);
    
    // Помечаем как прочитанные
    await this.messagesRepo.markAsRead(partnerId, currentUserId);
    
    return messages;
  }

  async sendMessage(senderId: number, recipientId: number, encryptedContent: string, encryptedKey: string = '') {
    return await this.messagesRepo.create({
      senderId,
      recipientId,
      encryptedContent,
      encryptedKey,
      isRead: false,
    });
  }

  async searchUsers(query: string, currentUserId: number) {
    return await this.usersRepo.searchByName(query, currentUserId);
  }
}