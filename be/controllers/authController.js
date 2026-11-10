const authService = require('../services/authService');

class AuthController {
    async login(req, res) {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        try {
            const data = await authService.login(email, password);

            // Set JWT token as cookie
            res.cookie('auth-token', data.session.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });

            return res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Login error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async register(req, res) {
        const { email, password, full_name } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and full name are required'
            });
        }

        try {
            const data = await authService.register(email, password, full_name);

            // Set JWT token as cookie
            res.cookie('auth-token', data.session.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });

            return res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Registration error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async logout(req, res) {
        // Clear the auth cookie
        res.clearCookie('auth-token');

        return res.json({
            success: true,
            message: 'Successfully logged out'
        });
    }

    async getProfile(req, res) {
        try {
            const user = req.user;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Not authenticated'
                });
            }

            const profileData = await authService.getUserById(user.id);

            return res.json({
                success: true,
                data: profileData.user
            });
        } catch (error) {
            console.error('Get profile error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async changePassword(req, res) {
        const { newPassword } = req.body;
        const userId = req.user.id;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                error: 'New password is required'
            });
        }

        try {
            await authService.changePassword(userId, newPassword);

            return res.json({
                success: true,
                message: 'Password updated successfully'
            });
        } catch (error) {
            console.error('Change password error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new AuthController();