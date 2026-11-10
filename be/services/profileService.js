
const prisma = require('../prisma/client');

class ProfileService {
  async getProfile(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: userId
        },
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              full_name: true,
              avatar_url: true,
              role: true
            }
          }
        }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return {
        id: user.id,
        email: user.email,
        full_name: user.profile?.full_name,
        avatar_url: user.profile?.avatar_url,
        role: user.profile?.role || 'user'
      };
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }
}

module.exports = new ProfileService();
