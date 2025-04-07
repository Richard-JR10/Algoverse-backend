const admin = require('../firebase-config');

const verifyUserToken = async (req, res, next) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('User token verification error:', error);
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

const verifyAdminToken = async (req, res, next) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        if (decodedToken.admin !== true) {
            return res.status(403).json({ error: 'Unauthorized: Admin access required' });
        }
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Admin token verification error:', error);
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

module.exports = { verifyUserToken, verifyAdminToken };