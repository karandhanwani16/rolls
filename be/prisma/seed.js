/**
 * Default owner for T. A. TEX — highest privilege on Profile.role (`admin`).
 * Schema default is `user`; there is no separate Role table.
 */
const bcrypt = require('bcrypt');
const prisma = require('./client');

const OWNER_EMAIL = 'karandhanwani20@gmail.com';
const OWNER_PASSWORD = 'Karan@123';
const OWNER_NAME = 'Karan Dhanwani';
const OWNER_ROLE = 'admin';
const BCRYPT_ROUNDS = 10;

async function ensureDefaultOwner(client = prisma) {
    const existing = await client.user.findUnique({
        where: { email: OWNER_EMAIL },
        include: { profile: true },
    });

    if (!existing) {
        const hashedPassword = await bcrypt.hash(OWNER_PASSWORD, BCRYPT_ROUNDS);
        await client.user.create({
            data: {
                email: OWNER_EMAIL,
                password: hashedPassword,
                profile: {
                    create: {
                        full_name: OWNER_NAME,
                        role: OWNER_ROLE,
                    },
                },
            },
        });
        console.log('Default owner created');
        return { created: true, email: OWNER_EMAIL, role: OWNER_ROLE };
    }

    const passwordMatches = await bcrypt.compare(OWNER_PASSWORD, existing.password);
    const roleNeedsUpdate = existing.profile?.role !== OWNER_ROLE;
    const nameNeedsUpdate = !existing.profile?.full_name;
    const profileMissing = !existing.profile;

    const data = {};
    if (!passwordMatches) {
        data.password = await bcrypt.hash(OWNER_PASSWORD, BCRYPT_ROUNDS);
    }
    if (profileMissing) {
        data.profile = {
            create: {
                full_name: OWNER_NAME,
                role: OWNER_ROLE,
            },
        };
    } else if (roleNeedsUpdate || nameNeedsUpdate) {
        data.profile = {
            update: {
                ...(roleNeedsUpdate ? { role: OWNER_ROLE } : {}),
                ...(nameNeedsUpdate ? { full_name: OWNER_NAME } : {}),
            },
        };
    }

    if (Object.keys(data).length > 0) {
        await client.user.update({
            where: { id: existing.id },
            data,
        });
    }

    console.log('Default owner already present');
    return { created: false, email: OWNER_EMAIL, role: OWNER_ROLE };
}

async function main() {
    await ensureDefaultOwner();
}

module.exports = { ensureDefaultOwner, OWNER_EMAIL, OWNER_ROLE };

if (require.main === module) {
    main()
        .then(async () => {
            await prisma.$disconnect();
        })
        .catch(async (error) => {
            console.error('Default owner seed failed:', error.message);
            await prisma.$disconnect();
            process.exit(1);
        });
}
