import PostsRepository from '../repositories/posts.repository.js';
import UsersRepository from '../repositories/users.repository.js';
export default class PostsService {
    postsRepo = new PostsRepository();
    usersRepo = new UsersRepository();
    async getWallPosts(targetUserId, filter = 'all') {
        const posts = await this.postsRepo.findByTargetUserId(targetUserId, filter);
        const postsWithAuthors = await Promise.all(posts.map(async (post) => {
            const author = await this.usersRepo.findById(post.authorId);
            return {
                id: post.id,
                authorId: post.authorId,
                authorName: author ? `${author.firstName} ${author.lastName}` : 'Неизвестный',
                text: post.content,
                createdAt: post.createdAt,
                likes: 0,
                liked: false,
                comments: 0,
                shares: 0,
            };
        }));
        return postsWithAuthors;
    }
    async createPost(authorId, targetUserId, content) {
        const post = await this.postsRepo.create({
            authorId,
            targetUserId,
            content,
        });
        const author = await this.usersRepo.findById(authorId);
        return {
            id: post.id,
            authorId: post.authorId,
            authorName: author ? `${author.firstName} ${author.lastName}` : 'Неизвестный',
            text: post.content,
            createdAt: post.createdAt,
            likes: 0,
            liked: false,
            comments: 0,
            shares: 0,
        };
    }
    async deletePost(postId, authorId) {
        await this.postsRepo.delete(postId, authorId);
    }
}
