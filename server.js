const express = require('express');
const cors = require('cors');
const { verifyAdminToken, verifyUserToken} = require('./middleware/authMiddleware');
const admin = require('./firebase-config');
const app = express();
const port = 3000;

const db = admin.firestore();

const allowedOrigins = [
    'http://localhost:5173',    // React dev server
];

app.use(cors({
    origin: allowedOrigins, // Restrict to your React app’s origin
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json()); // Parse JSON bodies
app.use(verifyUserToken); // Apply admin token verification globally

// Fetch all users
app.get('/api/users', verifyAdminToken, async (req, res) => {
    try {
        const listUsersResult = await admin.auth().listUsers(1000);
        const defaultPhotoURL = 'https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp';
        const users = listUsersResult.users.map((userRecord) => ({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            disabled: userRecord.disabled,
            photoURL: userRecord.photoURL || defaultPhotoURL,
            admin: userRecord.customClaims?.admin === true,
        }));
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Disable a user
app.post('/api/users/disable', verifyAdminToken,  async (req, res) => {
    const { uid } = req.body;
    if (!uid || !Array.isArray(uid) || uid.length === 0) {
        return res.status(400).json({ error: 'uid array is required' });
    }

    try {
        await Promise.all(uid.map((uid) => admin.auth().updateUser(uid, { disabled: true })));
        res.status(200).json({ message: `Disabled ${uid.length} users successfully` });
    } catch (error) {
        console.error('Error disabling users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Enable a user
app.post('/api/users/enable', verifyAdminToken,  async (req, res) => {
    const { uid } = req.body;

    if (!uid || !Array.isArray(uid) || uid.length === 0) {
        return res.status(400).json({ error: 'uid array is required' });
    }

    try {
        await Promise.all(uid.map((uid) => admin.auth().updateUser(uid, { disabled: false })));
        res.status(200).json({ message: `Enabled ${uid.length} users successfully` });
    } catch (error) {
        console.error('Error enabling users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Delete a user
app.post('/api/users/delete', verifyAdminToken, async (req, res) => {
    const { uid } = req.body;
    if (!uid || !Array.isArray(uid) || uid.length === 0) {
        return res.status(400).json({ error: 'uid array is required' });
    }

    try {
        await Promise.all(uid.map((uid) => admin.auth().deleteUser(uid)));
        res.status(200).json({ message: `Deleted ${uid.length} users successfully` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//Set Admin
app.post('/api/users/remove-admin', verifyAdminToken,  async (req, res) => {
    const { uid } = req.body;
    if (!uid || !Array.isArray(uid) || uid.length === 0) {
        return res.status(400).json({ error: 'uid array is required' });
    }

    try {
        await Promise.all(uid.map((uid) => admin.auth().setCustomUserClaims(uid, { admin: false })));
        res.status(200).json({ message: `Remove ${uid.length} users as admin successfully` });
    } catch (error) {
        console.error('Error setting custom claims:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

//Remove Admin
app.post('/api/users/set-admin', verifyAdminToken,  async (req, res) => {
    const { uid } = req.body;
    if (!uid || !Array.isArray(uid) || uid.length === 0) {
        return res.status(400).json({ error: 'uid array is required' });
    }

    try {
        await Promise.all(uid.map((uid) => admin.auth().setCustomUserClaims(uid, { admin: true })));
        res.status(200).json({ message: `Set ${uid.length} users as admin successfully` });
    } catch (error) {
        console.error('Error setting custom claims:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

app.get('/api/library', async (req, res) => {
    try {
        const snapshot = await db.collection('codeLibrary').get();
        if (snapshot.empty) {
            return res.status(200).json([]); // Return empty array if no entries
        }

        const codeEntries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json(codeEntries);
    } catch (error) {
        console.error('Error fetching code entries:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/addLibrary', verifyAdminToken, async (req, res) => {
    const { title, category, description, codeData} = req.body;

    if (!title || !category || !description || !codeData) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!Array.isArray(codeData)) {
        return res.status(400).json({ error: 'codeData must be an array' });
    }

    try {
        const docRef = await db.collection('codeLibrary').add({
            title,
            category,
            description,
            codeData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({
            message: 'Code entry added successfully',
            id: docRef.id,
        });
    } catch (error) {
        console.error('Error adding code entry:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



// delete library data
app.delete('/api/library/delete', verifyAdminToken, async (req, res) => {
    const { id } = req.body;
    if (!id || !Array.isArray(id) || id.length === 0) {
        return res.status(400).json({ error: 'id array is required' });
    }

    try {
        const batch = db.batch();

        id.forEach((docId) => {
            const docRef = db.collection('codeLibrary').doc(docId);
            batch.delete(docRef);
        })

        await batch.commit();

        res.status(200).json({ message: `Deleted ${id.length} library items successfully` });
    } catch (error) {
        console.error('Error deleting id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})