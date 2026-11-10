const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../prisma/client');

class AuthService {
    async login(email, password) {
        try {
            // Find the user by email
            const user = await prisma.user.findUnique({
                where: { email }
            });

            if (!user) {
                throw new Error('Invalid email or password');
            }

            // Check if password matches
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                throw new Error('Invalid email or password');
            }

            // Get user profile, or create one if this user was inserted without it
            let profile = await prisma.profile.findUnique({
                where: { id: user.id }
            });

            if (!profile) {
                profile = await prisma.profile.create({
                    data: {
                        id: user.id,
                        full_name: email.split('@')[0],
                        role: 'user'
                    }
                });
            }

            // Generate JWT token
            const token = jwt.sign({
                    id: user.id,
                    email: user.email
                },
                process.env.JWT_SECRET, { expiresIn: '24h' }
            );

            return {
                session: {
                    access_token: token,
                    token_type: 'bearer',
                    expires_in: 86400 // 24 hours in seconds
                },
                user: {
                    id: user.id,
                    email: user.email,
                    aud: "authenticated",
                    role: profile?.role || 'user'
                }
            };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async register(email, password, fullName) {
        try {
            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email }
            });

            if (existingUser) {
                throw new Error('User already exists');
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user and profile in a transaction
            const result = await prisma.$transaction(async(tx) => {
                // Create user
                const user = await tx.user.create({
                    data: {
                        email,
                        password: hashedPassword
                    }
                });

                // Create profile
                const profile = await tx.profile.create({
                    data: {
                        id: user.id,
                        full_name: fullName,
                        role: 'user'
                    }
                });

                // Generate JWT token
                const token = jwt.sign({
                        id: user.id,
                        email: user.email
                    },
                    process.env.JWT_SECRET, { expiresIn: '24h' }
                );

                return {
                    session: {
                        access_token: token,
                        token_type: 'bearer',
                        expires_in: 86400 // 24 hours in seconds
                    },
                    user: {
                        id: user.id,
                        email: user.email,
                        aud: "authenticated",
                        role: profile.role || 'user'
                    }
                };
            });

            return result;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    async logout(token) {
        // Since we're using JWT, we don't need to do anything server-side
        // JWT tokens are stateless and will expire on their own
        // The frontend will remove the token from localStorage
        return { success: true };
    }

    async getUserById(userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
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
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.profile?.full_name,
                    avatar_url: user.profile?.avatar_url,
                    role: user.profile?.role || 'user'
                }
            };
        } catch (error) {
            console.error('Get user error:', error);
            throw error;
        }
    }

    async verifyToken(token) {
        try {
            // Verify the JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from database
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
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
                aud: "authenticated",
                role: user.profile?.role || 'user'
            };
        } catch (error) {
            console.error('Token verification error:', error);
            throw error;
        }
    }

    async changePassword(userId, newPassword) {
        try {
            // Check if user exists
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Hash the new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update the user's password
            await prisma.user.update({
                where: { id: userId },
                data: { password: hashedPassword }
            });

            return { success: true };
        } catch (error) {
            console.error('Change password error:', error);
            throw error;
        }
    }
}

module.exports = new AuthService();