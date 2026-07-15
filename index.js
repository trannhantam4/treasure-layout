const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK so it can access Firestore
admin.initializeApp();

/**
 * This Cloud Function triggers whenever a new user is created in Firebase Authentication.
 * It then creates a corresponding user document in the 'users' collection in Firestore,
 * assigning them a default 'visitor' role and saving their basic profile info.
 */
exports.assignDefaultRole = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL } = user;

  const newUserDocument = {
    uid,
    email,
    name: displayName || "New User", // Use provided name or a default
    photoURL: photoURL || `https://i.pravatar.cc/150?u=${uid}`, // Use provided photo or a default avatar
    role: "visitor", // Assign the default role
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await admin.firestore().collection("users").doc(uid).set(newUserDocument);
    functions.logger.log(`Successfully created user document for ${email} (UID: ${uid}).`);
  } catch (error) {
    functions.logger.error(`Error creating user document for UID: ${uid}`, error);
  }
});