import PostsService from '../services/posts.service.js';
const postsService = new PostsService();
export const postsRoutes = async (app) => {
    // Получить записи стены
    app.get('/wall/:userId', async (request, reply) => {
        const { userId } = request.params;
        const targetUserId = parseInt(userId, 10);
        const filter = request.query.filter || 'all';
        if (isNaN(targetUserId)) {
            return reply.status(400).send({ error: 'Некорректный ID' });
        }
        const posts = await postsService.getWallPosts(targetUserId, filter);
        return { posts };
    });
    // Создать запись на стене
    app.post('/wall/:userId', {
        preValidation: [app.authenticate],
    }, async (request, reply) => {
        const authorId = request.user.userId;
        const { userId } = request.params;
        const targetUserId = parseInt(userId, 10);
        const { content } = request.body;
        if (isNaN(targetUserId)) {
            return reply.status(400).send({ error: 'Некорректный ID' });
        }
        if (!content || !content.trim()) {
            return reply.status(400).send({ error: 'Пустое сообщение' });
        }
        const post = await postsService.createPost(authorId, targetUserId, content.trim());
        return reply.status(201).send({ post });
    });
    // Удалить запись
    app.delete('/wall/:postId', {
        preValidation: [app.authenticate],
    }, async (request, reply) => {
        const authorId = request.user.userId;
        const { postId } = request.params;
        const postIdNum = parseInt(postId, 10);
        if (isNaN(postIdNum)) {
            return reply.status(400).send({ error: 'Некорректный ID' });
        }
        await postsService.deletePost(postIdNum, authorId);
        return { success: true };
    });
};
