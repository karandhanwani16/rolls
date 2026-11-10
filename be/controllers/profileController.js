
const profileService = require('../services/profileService');

class ProfileController {
  async getProfile(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ 
          success: false, 
          error: 'Not authenticated' 
        });
      }
      
      const profile = await profileService.getProfile(req.user.id);
      return res.json(profile);
    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

module.exports = new ProfileController();
