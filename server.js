const express = require('express');
const cors = require('cors');
const { verifyAdminToken, verifyUserToken} = require('./middleware/authMiddleware');
const admin = require('./firebase-config');
const app = express();
const port = 3000;

const db = admin.firestore();

const allowedOrigins = [
    'http://localhost:5173',
    'https://algoverse1.netlify.app'
];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(verifyUserToken);

// Fetch all users with providerData and lastSignInTime
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
            providerData: userRecord.providerData.map(provider => ({
                providerId: provider.providerId,
                email: provider.email,
                displayName: provider.displayName,
                photoURL: provider.photoURL,
                phoneNumber: provider.phoneNumber
            })),
            lastSignInTime: userRecord.metadata.lastSignInTime
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

// fetch all library data
app.get('/api/library', async (req, res) => {
    try {
        const snapshot = await db.collection('codeLibrary').get();
        if (snapshot.empty) {
            return res.status(200).json([]);
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

// add library
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

app.put('/api/updateLibrary', verifyAdminToken,  async (req, res) => {
    const { id, title, category, description, codeData } = req.body;

    if (!id) {
        console.error('Document ID is required')
        return res.status(400).json({ error: 'Document ID is required' });
    }

    if (!title || !category || !description || !codeData) {
        console.error('All fields are required')
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!Array.isArray(codeData)) {
        console.error('codeData must be an array')
        return res.status(400).json({ error: 'codeData must be an array' });
    }

    try {
        // Check if the document exists first
        const docRef = db.collection('codeLibrary').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Update the document
        await docRef.update({
            title,
            category,
            description,
            codeData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({
            message: 'Code entry updated successfully',
            id
        });
    } catch (error) {
        console.error('Error updating code entry:', error);
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

// fetch all example data
app.get('/api/example', async (req, res) => {
    try {
        const snapshot = await db.collection('example').get();
        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        const codeEntries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json(codeEntries);
    } catch (error) {
        console.error('Error fetching example data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// add example
app.post('/api/addExample', verifyAdminToken, async (req, res) => {
    const { title, category, description, examples} = req.body;

    if (!title || !category || !description || !examples) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!Array.isArray(examples)) {
        return res.status(400).json({ error: 'examples must be an array' });
    }

    try {
        const docRef = await db.collection('example').add({
            title,
            category,
            description,
            examples,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({
            message: 'Example entry added successfully',
            id: docRef.id,
        });
    } catch (error) {
        console.error('Error adding Example entry:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

//update example
app.put('/api/updateExample', verifyAdminToken,  async (req, res) => {
    const { id, title, category, description, examples } = req.body;

    if (!id) {
        console.error('Document ID is required')
        return res.status(400).json({ error: 'Document ID is required' });
    }

    if (!title || !category || !description || !examples) {
        console.error('All fields are required')
        return res.status(400).json({error: 'All fields are required'});
    }

    if (!Array.isArray(examples)) {
        console.error('codeData must be an array')
        return res.status(400).json({ error: 'examples must be an array' });
    }

    try {
        // Check if the document exists first
        const docRef = db.collection('example').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Update the document
        await docRef.update({
            title,
            category,
            description,
            examples,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({
            message: 'Example data updated successfully',
            id
        });
    } catch (error) {
        console.error('Error updating example data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})


// delete example data
app.delete('/api/deleteExample', verifyAdminToken, async (req, res) => {
    const { id } = req.body;
    if (!id || !Array.isArray(id) || id.length === 0) {
        return res.status(400).json({ error: 'id array is required' });
    }

    try {
        const batch = db.batch();

        id.forEach((docId) => {
            const docRef = db.collection('example').doc(docId);
            batch.delete(docRef);
        })

        await batch.commit();

        res.status(200).json({ message: `Deleted ${id.length} example items successfully` });
    } catch (error) {
        console.error('Error deleting id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// fetch all challenges data
app.get('/api/challenges', async (req, res) => {
    try {
        const snapshot = await db.collection('challenges').get();
        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        const codeEntries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json(codeEntries);
    } catch (error) {
        console.error('Error fetching example data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add challenges
app.post('/api/addChallenges', verifyAdminToken, async (req, res) => {
    const { title, category, questions, type, difficulty } = req.body;

    // Validate request body
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
    }
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'Request body must include a non-empty questions array' });
    }
    if (!type || ![1, 2, 3].includes(type)) {
        return res.status(400).json({ error: 'Type is required and must be 1, 2, or 3' });
    }
    if (!difficulty || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
        return res.status(400).json({ error: 'Difficulty is required and must be Easy, Medium, or Hard' });
    }
    if (!category || !['Sorting', 'Search', 'Graph Traversal', 'Recursion'].includes(category)) {
        return res.status(400).json({ error: 'Category is required and must be Sorting, Search, Graph Traversal, or Recursion' });
    }

    // Validate each question
    for (const challenge of questions) {
        // Type-specific validation
        if (type === 1) {
            const { question, answer, choices } = challenge;
            if (!question || !answer || !choices || !Array.isArray(choices) || choices.length !== 4) {
                return res.status(400).json({ error: 'Multiple Choices requires question, answer, and exactly 4 choices' });
            }
        } else if (type === 2) {
            const { algorithm, initialArray, expectedArray, stepDescription, explanation } = challenge;
            if (
                !algorithm ||
                !initialArray ||
                !expectedArray ||
                !stepDescription ||
                !explanation ||
                !Array.isArray(initialArray) ||
                !Array.isArray(expectedArray)
            ) {
                return res.status(400).json({
                    error: 'Sorting Arrangement requires algorithm, initialArray, expectedArray, stepDescription, and explanation, with arrays for initialArray and expectedArray',
                });
            }
        } else if (type === 3) {
            const { text, correctAnswers, choices, explanation } = challenge;
            if (
                !text ||
                !correctAnswers ||
                !choices ||
                !explanation ||
                !Array.isArray(correctAnswers)||
                !Array.isArray(choices)
            ) {
                return res.status(400).json({
                    error: 'Fill In The Blanks requires text, correctAnswers, choices, and explanation',
                });
            }
        }
    }

    try {
        // Store all data in a single document
        const docRef = await admin.firestore().collection('challenges').add({
            title,
            category,
            questions,
            type,
            difficulty,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(201).json({
            message: 'Challenges added successfully',
            id: docRef.id,
        });
    } catch (error) {
        console.error('Error adding challenges:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//update challenges
app.put('/api/updateChallenges', verifyAdminToken,  async (req, res) => {
    const { id, title, category, type, difficulty, questions } = req.body;

    if (!id) {
        console.error('Document ID is required')
        return res.status(400).json({ error: 'Document ID is required' });
    }

    if (!title || !category || !type || !difficulty || !questions) {
        console.error('All fields are required')
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!Array.isArray(questions)) {
        console.error('Questions must be an array')
        return res.status(400).json({ error: 'Questions must be an array' });
    }

    try {
        // Check if the document exists first
        const docRef = db.collection('challenges').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Update the document
        await docRef.update({
            title,
            category,
            type,
            difficulty,
            questions,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({
            message: 'Challenges data updated successfully',
            id
        });
    } catch (error) {
        console.error('Error updating challenges data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})


// delete challenges data
app.delete('/api/deleteChallenges', verifyAdminToken, async (req, res) => {
    const { id } = req.body;
    if (!id || !Array.isArray(id) || id.length === 0) {
        return res.status(400).json({ error: 'id array is required' });
    }

    try {
        const batch = db.batch();

        id.forEach((docId) => {
            const docRef = db.collection('challenges').doc(docId);
            batch.delete(docRef);
        })

        await batch.commit();

        res.status(200).json({ message: `Deleted ${id.length} challenge items successfully` });
    } catch (error) {
        console.error('Error deleting id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Complete a challenge and update userProgress
app.post('/api/completeChallenge', async (req, res) => {
    const { challengeId, points, answers, score } = req.body;
    const userId = req.user.uid; // From verifyUserToken middleware

    if (!challengeId || typeof challengeId !== 'string' || challengeId.trim() === '') {
        return res.status(400).json({ error: 'challengeId is required and must be a non-empty string' });
    }
    if (points == null || typeof points !== 'number' || points < 0) {
        return res.status(400).json({ error: 'points is required and must be a positive number' });
    }
    if (!Array.isArray(answers)) {
        return res.status(400).json({ error: 'answers is required and must be an array' });
    }
    if (score == null || typeof score !== 'number' || score < 0) {
        return res.status(400).json({ error: 'score is required and must be a non-negative number' });
    }

    try {
        // Verify challenge exists
        const challengeRef = db.collection('challenges').doc(challengeId);
        const challengeSnap = await challengeRef.get();
        if (!challengeSnap.exists) {
            return res.status(404).json({ error: 'Challenge not found' });
        }

        const userProgressRef = db.collection('userProgress').doc(userId);
        const userProgressSnap = await userProgressRef.get();

        // Initialize document if it doesn't exist
        if (!userProgressSnap.exists) {
            await userProgressRef.set({
                Points: 0,
                SolvedChallenges: [],
                retryCount: {},
                challengeAttempts: {},
            });
        }

        // Check for duplicate completion
        const { SolvedChallenges = [] } = userProgressSnap.data() || {};
        if (SolvedChallenges.includes(challengeId)) {
            return res.status(200).json({ message: 'Challenge already completed, no points awarded' });
        }

        // Update Points, SolvedChallenges, and challengeAttempts
        await userProgressRef.update({
            Points: admin.firestore.FieldValue.increment(points),
            SolvedChallenges: admin.firestore.FieldValue.arrayUnion(challengeId),
            [`challengeAttempts.${challengeId}`]: { answers, score },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(200).json({ message: 'Challenge completed and user progress updated' });
    } catch (error) {
        console.error('Error updating user progress:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


//check user progress
app.get('/api/userProgress', async (req, res) => {
    const userId = req.user.uid;
    try {
        const userProgressRef = db.collection('userProgress').doc(userId);
        const userProgressSnap = await userProgressRef.get();

        if (!userProgressSnap.exists) {
            return res.status(200).json({
                Points: 0,
                SolvedChallenges: [],
                retryCount: {},
                challengeAttempts: {},
            });
        }

        const data = userProgressSnap.data();
        res.status(200).json({
            Points: data.Points || 0,
            SolvedChallenges: data.SolvedChallenges || [],
            retryCount: data.retryCount || {},
            challengeAttempts: data.challengeAttempts || {},
        });
    } catch (error) {
        console.error('Error fetching user progress:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Record a retry for a challenge
app.post('/api/recordRetry', async (req, res) => {
    const { challengeId, answers, score } = req.body;
    const userId = req.user.uid;

    if (!challengeId || typeof challengeId !== 'string' || challengeId.trim() === '') {
        return res.status(400).json({ error: 'challengeId is required and must be a non-empty string' });
    }
    if (!Array.isArray(answers)) {
        return res.status(400).json({ error: 'answers is required and must be an array' });
    }
    if (score == null || typeof score !== 'number' || score < 0) {
        return res.status(400).json({ error: 'score is required and must be a non-negative number' });
    }

    try {
        const challengeRef = db.collection('challenges').doc(challengeId);
        const challengeSnap = await challengeRef.get();
        if (!challengeSnap.exists) {
            return res.status(404).json({ error: 'Challenge not found' });
        }

        const userProgressRef = db.collection('userProgress').doc(userId);
        const userProgressSnap = await userProgressRef.get();

        if (!userProgressSnap.exists) {
            return res.status(400).json({ error: 'User progress not found' });
        }

        const { SolvedChallenges = [] } = userProgressSnap.data() || {};
        if (!SolvedChallenges.includes(challengeId)) {
            return res.status(400).json({ error: 'Challenge not completed yet' });
        }

        await userProgressRef.update({
            [`retryCount.${challengeId}`]: admin.firestore.FieldValue.increment(1),
            [`challengeAttempts.${challengeId}`]: { answers, score },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(200).json({ message: 'Retry recorded' });
    } catch (error) {
        console.error('Error recording retry:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/leaderboard endpoint
app.get('/api/leaderboard', async (req, res) => {
    try {
        const currentUserUid = req.user.uid;

        // Step 1: Fetch all users with UIDs and displayNames
        const listUsersResult = await admin.auth().listUsers(1000);
        let allUsers = listUsersResult.users;
        let nextPageToken = listUsersResult.pageToken;
        while (nextPageToken) {
            const nextPage = await admin.auth().listUsers(1000, nextPageToken);
            allUsers = allUsers.concat(nextPage.users);
            nextPageToken = nextPage.pageToken;
        }
        const users = allUsers.map(user => ({
            uid: user.uid,
            displayName: user.displayName || 'Anonymous'
        }));
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Fetched ${users.length} users`);
        }

        // Step 2: Fetch points for each user
        const userPointsPromises = users.map(async ({ uid, displayName }) => {
            const userProgressDoc = await db.collection('userProgress').doc(uid).get();
            const points = userProgressDoc.exists ? userProgressDoc.data().Points || 0 : 0;
            return { uid, displayName, points };
        });
        const userPoints = await Promise.all(userPointsPromises);
        if (process.env.NODE_ENV !== 'production') {
            console.log('Fetched points for all users');
        }

        // Step 3: Sort by points (descending) and displayName (ascending) for equal points
        userPoints.sort((a, b) => {
            if (b.points !== a.points) {
                return b.points - a.points; // Primary: Descending points
            }
            return a.displayName.localeCompare(b.displayName); // Secondary: Ascending displayName
        });

        // Step 4: Assign unique ranks and track current user's rank
        const leaderboard = [];
        let currentUserRank = null;

        for (let i = 0; i < userPoints.length; i++) {
            const user = userPoints[i];
            const rank = i + 1; // Unique rank based on position

            // Add to leaderboard if in top 10
            if (leaderboard.length < 10) {
                leaderboard.push({
                    rank,
                    displayName: user.displayName,
                    points: user.points,
                    uid: user.uid // For frontend key prop
                });
            }

            // Track current user's rank
            if (user.uid === currentUserUid) {
                currentUserRank = rank;
            }
        }

        // If current user not found in userPoints, assign last rank + 1
        if (currentUserRank === null) {
            currentUserRank = userPoints.length + 1;
            if (process.env.NODE_ENV !== 'production') {
                console.log(`Current user ${currentUserUid} not found in userPoints, assigned rank: ${currentUserRank}`);
            }
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log('Leaderboard generated:', { leaderboard, currentUserRank });
        }

        // Step 5: Return top 10 and current user's rank
        res.status(200).json({
            leaderboard,
            currentUserRank
        });
    } catch (error) {
        console.error('Error generating leaderboard:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({
            error: 'Failed to generate leaderboard',
            details: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})