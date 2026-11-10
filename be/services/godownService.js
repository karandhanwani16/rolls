const prisma = require('../prisma/client');

class GodownService {
    async getAllGodowns() {
        try {
            const godowns = await prisma.godown.findMany();
            return godowns;
        } catch (error) {
            console.error('Error fetching godowns:', error);
            throw error;
        }
    }

    async createGodown(data) {
        try {
            const godown = await prisma.godown.create({ data });
            return godown;
        } catch (error) {
            console.error('Error creating godown:', error);
            throw error;
        }
    }

    async updateGodown(id, data) {
        try {
            const godown = await prisma.godown.update({
                where: { id },
                data
            });
            return godown;
        } catch (error) {
            console.error('Error updating godown:', error);
            throw error;
        }
    }

    async deleteGodown(id) {
        try {
            await prisma.godown.delete({ where: { id } });
        } catch (error) {
            console.error('Error deleting godown:', error);
            throw error;
        }
    }
}

module.exports = new GodownService();