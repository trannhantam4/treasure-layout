const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteDoc } = require("firebase/firestore");
const fs = require("fs");

let testEnv;

before(async () => {
  // Set up the test environment
  testEnv = await initializeTestEnvironment({
    projectId: "treasure-layout-test",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: 'localhost',
      port: 8080,
    },
  });
});

after(async () => {
  // Tear down the test environment
  await testEnv.cleanup();
});

beforeEach(async () => {
  // Clear the database before each test
  await testEnv.clearFirestore();
});

// Helper function to get a Firestore instance for a specific user
function getFirestoreAs(auth) {
  return testEnv.authenticatedContext(auth?.uid, auth).firestore();
}

// Helper function to get an admin Firestore instance for setting up data
function getAdminFirestore() {
  return testEnv.unauthenticatedContext().firestore();
}

describe("Firestore Security Rules: Users Collection", () => {
  const admin = { uid: "admin-id", role: "admin" };
  const manager = { uid: "manager-id", role: "manager" };
  const visitor = { uid: "visitor-id", role: "visitor" };
  const otherUser = { uid: "other-user-id", role: "visitor" };

  beforeEach(async () => {
    // Pre-populate the database with user roles for testing
    const adminDb = getAdminFirestore();
    await setDoc(doc(adminDb, "users", admin.uid), { name: "Admin User", role: "admin" });
    await setDoc(doc(adminDb, "users", manager.uid), { name: "Manager User", role: "manager" });
    await setDoc(doc(adminDb, "users", visitor.uid), { name: "Visitor User", role: "visitor" });
    await setDoc(doc(adminDb, "users", otherUser.uid), { name: "Other User", role: "visitor" });
  });

  // == READ Rules ==
  it("should allow a user to read their own profile", async () => {
    const db = getFirestoreAs(visitor);
    await assertSucceeds(getDoc(doc(db, "users", visitor.uid)));
  });

  it("should NOT allow a user to read another user's profile", async () => {
    const db = getFirestoreAs(visitor);
    await assertFails(getDoc(doc(db, "users", otherUser.uid)));
  });

  it("should allow an admin to read any user's profile", async () => {
    const db = getFirestoreAs(admin);
    await assertSucceeds(getDoc(doc(db, "users", visitor.uid)));
  });

  it("should allow a manager to read any user's profile", async () => {
    const db = getFirestoreAs(manager);
    await assertSucceeds(getDoc(doc(db, "users", visitor.uid)));
  });

  // == CREATE Rules ==
  it("should allow a user to create their own profile (without a role)", async () => {
    const newUser = { uid: "new-user-id" };
    const db = getFirestoreAs(newUser);
    await assertSucceeds(setDoc(doc(db, "users", newUser.uid), { name: "Newbie" }));
  });

  it("should NOT allow a user to create their own profile WITH a role", async () => {
    const newUser = { uid: "new-user-id" };
    const db = getFirestoreAs(newUser);
    await assertFails(setDoc(doc(db, "users", newUser.uid), { name: "Newbie", role: "admin" }));
  });

  // == UPDATE Rules ==
  it("should allow a user to update their own profile (but not their role)", async () => {
    const db = getFirestoreAs(visitor);
    await assertSucceeds(updateDoc(doc(db, "users", visitor.uid), { name: "Updated Name" }));
  });

  it("should NOT allow a user to change their own role", async () => {
    const db = getFirestoreAs(visitor);
    await assertFails(updateDoc(doc(db, "users", visitor.uid), { role: "admin" }));
  });

  it("should allow an admin to update any user's role", async () => {
    const db = getFirestoreAs(admin);
    await assertSucceeds(updateDoc(doc(db, "users", visitor.uid), { role: "manager" }));
  });

  it("should NOT allow a manager to promote a user to admin", async () => {
    const db = getFirestoreAs(manager);
    await assertFails(updateDoc(doc(db, "users", visitor.uid), { role: "admin" }));
  });

  it("should NOT allow a manager to edit another manager", async () => {
    const db = getFirestoreAs(manager);
    await assertFails(updateDoc(doc(db, "users", manager.uid), { name: "Should Fail" }));
  });

  // == DELETE Rules ==
  it("should allow an admin to delete a user", async () => {
    const db = getFirestoreAs(admin);
    await assertSucceeds(deleteDoc(doc(db, "users", visitor.uid)));
  });

  it("should NOT allow a manager to delete a user", async () => {
    const db = getFirestoreAs(manager);
    await assertFails(deleteDoc(doc(db, "users", visitor.uid)));
  });
});


describe("Firestore Security Rules: Event Collection", () => {
  const admin = { uid: "admin-id", role: "admin" };
  const manager = { uid: "manager-id", role: "manager" };
  const visitor = { uid: "visitor-id", role: "visitor" };
  const eventId = "test-event";

  beforeEach(async () => {
    // Pre-populate with user roles and a sample event
    const adminDb = getAdminFirestore();
    await setDoc(doc(adminDb, "users", admin.uid), { role: "admin" });
    await setDoc(doc(adminDb, "users", manager.uid), { role: "manager" });
    await setDoc(doc(adminDb, "users", visitor.uid), { role: "visitor" });
    await setDoc(doc(adminDb, "event", eventId), {
      eventName: "Test Event",
      registeredUsers: [],
    });
  });

  // == READ Rules ==
  it("should allow anyone (even unauthenticated) to read events", async () => {
    const db = getFirestoreAs(null); // Unauthenticated user
    await assertSucceeds(getDoc(doc(db, "event", eventId)));
  });

  // == CREATE Rules ==
  it("should allow an admin to create an event", async () => {
    const db = getFirestoreAs(admin);
    await assertSucceeds(setDoc(doc(db, "event", "new-event"), { eventName: "Admin Event" }));
  });

  it("should allow a manager to create an event", async () => {
    const db = getFirestoreAs(manager);
    await assertSucceeds(setDoc(doc(db, "event", "new-event"), { eventName: "Manager Event" }));
  });

  it("should NOT allow a visitor to create an event", async () => {
    const db = getFirestoreAs(visitor);
    await assertFails(setDoc(doc(db, "event", "new-event"), { eventName: "Visitor Event" }));
  });

  // == UPDATE Rules ==
  it("should allow a user to register for an event (update registeredUsers)", async () => {
    const db = getFirestoreAs(visitor);
    const eventRef = doc(db, "event", eventId);
    await assertSucceeds(updateDoc(eventRef, { registeredUsers: [visitor.uid] }));
  });

  it("should allow a user to un-register from an event", async () => {
    // First, register the user with admin privileges
    const adminDb = getAdminFirestore();
    await updateDoc(doc(adminDb, "event", eventId), { registeredUsers: [visitor.uid] });

    // Then, test the un-register action as the user
    const db = getFirestoreAs(visitor);
    const eventRef = doc(db, "event", eventId);
    await assertSucceeds(updateDoc(eventRef, { registeredUsers: [] }));
  });

  it("should NOT allow a user to change the event name", async () => {
    const db = getFirestoreAs(visitor);
    const eventRef = doc(db, "event", eventId);
    await assertFails(updateDoc(eventRef, { eventName: "Malicious Update" }));
  });

  it("should NOT allow a user to modify registeredUsers and another field at the same time", async () => {
    const db = getFirestoreAs(visitor);
    const eventRef = doc(db, "event", eventId);
    await assertFails(updateDoc(eventRef, {
      eventName: "Malicious Update",
      registeredUsers: [visitor.uid]
    }));
  });
});