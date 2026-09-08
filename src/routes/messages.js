export const messageRoutes = async (app) => {
    app.get('/', async (request, reply) => {
        return { message: 'Messages endpoint - TODO' };
    });
};
