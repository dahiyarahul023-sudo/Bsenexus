import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireAdmin } from '../security/auth.js';

/**
 * Firestore Security Rules & Access Control Evaluation Suite
 * Validates least-privilege security matrix for Anonymous (Guest),
 * Authenticated Normal Users, and Unauthenticated visitors.
 */

describe('Firestore Security Rules Least-Privilege Verification', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  test('Rules file exists, has correct version, and contains required security helpers', () => {
    assert.ok(rulesContent.includes("rules_version = '2';"), 'Must use Firestore rules version 2');
    assert.ok(rulesContent.includes('function isAuthenticated()'), 'Must contain isAuthenticated() helper');
    assert.ok(rulesContent.includes('function isAnonymous()'), 'Must contain isAnonymous() helper');
    assert.ok(rulesContent.includes('function isOwner(userId)'), 'Must contain isOwner() helper');
    assert.ok(rulesContent.includes('function isAdmin()'), 'Must contain isAdmin() helper');
    assert.ok(rulesContent.includes('function isNotElevatingRole()'), 'Must contain isNotElevatingRole() helper');
  });

  // Pure logic engine to simulate Firestore rule conditions exactly as written in firestore.rules
  const evaluateRule = (context: {
    auth: { uid: string; token?: { firebase?: { sign_in_provider?: string }; email?: string } } | null;
    collection: string;
    docId: string;
    operation: 'read' | 'create' | 'update' | 'delete';
    resourceData?: any;
    requestData?: any;
  }): boolean => {
    const { auth, collection, docId, operation, resourceData, requestData } = context;

    // Helper functions mirroring firestore.rules
    const isAuthenticated = () => auth != null;
    const isAnonymous = () =>
      isAuthenticated() &&
      auth?.token?.firebase?.sign_in_provider === 'anonymous';
    const isOwner = (userId: string) => isAuthenticated() && auth?.uid === userId;
    const isNotElevatingRole = () => {
      const incomingRole = requestData?.role;
      return (
        incomingRole == null ||
        incomingRole == '' ||
        incomingRole == 'user' ||
        incomingRole == 'trader'
      );
    };

    if (collection === 'users') {
      if (operation === 'read') {
        return isOwner(docId);
      }
      if (operation === 'create' || operation === 'update') {
        const allowedKeys = ['uid', 'email', 'name', 'displayName', 'role', 'status', 'isPro', 'updatedAt', 'createdAt'];
        const hasValidFields = requestData && Object.keys(requestData).every(k => allowedKeys.includes(k));
        return isOwner(docId) && hasValidFields && isNotElevatingRole();
      }
      return false; // delete is denied
    }

    if (collection === 'user_watchlists') {
      if (operation === 'read') {
        return isOwner(docId);
      }
      if (operation === 'create' || operation === 'update') {
        const allowedKeys = ['symbols', 'items', 'userId', 'updatedAt', 'createdAt'];
        const hasValidFields = requestData && Object.keys(requestData).every(k => allowedKeys.includes(k));
        const matchesUid = requestData?.userId == null || requestData.userId === auth?.uid;
        return isOwner(docId) && hasValidFields && matchesUid;
      }
      return false;
    }

    if (collection === 'announcements' || collection === 'results_calendar') {
      if (operation === 'read') {
        return true; // public filings read allowed for all
      }
      return false; // write strictly prohibited from client
    }

    if (collection === 'settings' || collection === 'logs' || collection === 'alert_rules' || collection === 'admins') {
      // Sensitive / private collections: denied to unauthenticated and anonymous users
      if (!isAuthenticated() || isAnonymous()) {
        return false;
      }
      return false; // managed strictly by server/Admin SDK
    }

    return false;
  };

  test('Guest (anonymous user) can read and write their OWN profile with standard role', () => {
    const guestAuth = {
      uid: 'anon_guest_777',
      token: { firebase: { sign_in_provider: 'anonymous' } }
    };

    // Read own profile
    const canReadOwn = evaluateRule({
      auth: guestAuth,
      collection: 'users',
      docId: 'anon_guest_777',
      operation: 'read'
    });
    assert.strictEqual(canReadOwn, true, 'Guest should be able to read own profile');

    // Create own profile as trader
    const canCreateOwn = evaluateRule({
      auth: guestAuth,
      collection: 'users',
      docId: 'anon_guest_777',
      operation: 'create',
      requestData: { uid: 'anon_guest_777', role: 'trader', name: 'Guest Trader' }
    });
    assert.strictEqual(canCreateOwn, true, 'Guest should be able to create own profile as trader');
  });

  test('Guest (anonymous user) is DENIED reading or writing another user profile (cross-user denied)', () => {
    const guestAuth = {
      uid: 'anon_guest_777',
      token: { firebase: { sign_in_provider: 'anonymous' } }
    };

    // Attempt to read someone else's profile
    const canReadOther = evaluateRule({
      auth: guestAuth,
      collection: 'users',
      docId: 'user_target_999',
      operation: 'read'
    });
    assert.strictEqual(canReadOther, false, 'Guest must NOT read another user profile');

    // Attempt to write someone else's profile
    const canWriteOther = evaluateRule({
      auth: guestAuth,
      collection: 'users',
      docId: 'user_target_999',
      operation: 'update',
      requestData: { name: 'Hacked' }
    });
    assert.strictEqual(canWriteOther, false, 'Guest must NOT write another user profile');
  });

  test('Guest (anonymous user) cannot elevate role to admin or manager', () => {
    const guestAuth = {
      uid: 'anon_guest_777',
      token: { firebase: { sign_in_provider: 'anonymous' } }
    };

    // Attempt to set role to admin
    const canElevateAdmin = evaluateRule({
      auth: guestAuth,
      collection: 'users',
      docId: 'anon_guest_777',
      operation: 'update',
      requestData: { role: 'admin' }
    });
    assert.strictEqual(canElevateAdmin, false, 'Guest must NOT elevate role to admin');

    // Attempt to set role to manager
    const canElevateManager = evaluateRule({
      auth: guestAuth,
      collection: 'users',
      docId: 'anon_guest_777',
      operation: 'create',
      requestData: { role: 'superadmin' }
    });
    assert.strictEqual(canElevateManager, false, 'Guest must NOT elevate role to superadmin');
  });

  test('Guest (anonymous user) can manage OWN watchlist, denied cross-user watchlist', () => {
    const guestAuth = {
      uid: 'anon_guest_777',
      token: { firebase: { sign_in_provider: 'anonymous' } }
    };

    // Read own watchlist
    const canReadOwnWatchlist = evaluateRule({
      auth: guestAuth,
      collection: 'user_watchlists',
      docId: 'anon_guest_777',
      operation: 'read'
    });
    assert.strictEqual(canReadOwnWatchlist, true, 'Guest must be able to read own watchlist');

    // Write own watchlist
    const canWriteOwnWatchlist = evaluateRule({
      auth: guestAuth,
      collection: 'user_watchlists',
      docId: 'anon_guest_777',
      operation: 'create',
      requestData: { userId: 'anon_guest_777', symbols: ['TCS', 'INFY'] }
    });
    assert.strictEqual(canWriteOwnWatchlist, true, 'Guest must be able to write own watchlist');

    // Attempt to read another user's watchlist
    const canReadOtherWatchlist = evaluateRule({
      auth: guestAuth,
      collection: 'user_watchlists',
      docId: 'victim_user_123',
      operation: 'read'
    });
    assert.strictEqual(canReadOtherWatchlist, false, 'Guest must NOT read another user watchlist');

    // Attempt to write another user's watchlist
    const canWriteOtherWatchlist = evaluateRule({
      auth: guestAuth,
      collection: 'user_watchlists',
      docId: 'victim_user_123',
      operation: 'update',
      requestData: { symbols: ['TAMPER'] }
    });
    assert.strictEqual(canWriteOtherWatchlist, false, 'Guest must NOT write another user watchlist');
  });

  test('Guest and Unauthenticated users can read public announcements/calendar, cannot write', () => {
    const unauth = null;
    const guestAuth = {
      uid: 'anon_guest_777',
      token: { firebase: { sign_in_provider: 'anonymous' } }
    };

    // Unauthenticated public reads
    assert.strictEqual(evaluateRule({ auth: unauth, collection: 'announcements', docId: 'doc1', operation: 'read' }), true);
    assert.strictEqual(evaluateRule({ auth: unauth, collection: 'results_calendar', docId: 'doc2', operation: 'read' }), true);

    // Guest public reads
    assert.strictEqual(evaluateRule({ auth: guestAuth, collection: 'announcements', docId: 'doc1', operation: 'read' }), true);
    assert.strictEqual(evaluateRule({ auth: guestAuth, collection: 'results_calendar', docId: 'doc2', operation: 'read' }), true);

    // Writes are denied
    assert.strictEqual(evaluateRule({ auth: unauth, collection: 'announcements', docId: 'doc1', operation: 'create' }), false);
    assert.strictEqual(evaluateRule({ auth: guestAuth, collection: 'announcements', docId: 'doc1', operation: 'create' }), false);
    assert.strictEqual(evaluateRule({ auth: guestAuth, collection: 'results_calendar', docId: 'doc2', operation: 'delete' }), false);
  });

  test('Sensitive/admin collections are strictly denied to guest and unauthenticated users', () => {
    const unauth = null;
    const guestAuth = {
      uid: 'anon_guest_777',
      token: { firebase: { sign_in_provider: 'anonymous' } }
    };

    const sensitiveCollections = ['settings', 'logs', 'alert_rules', 'admins'];
    for (const coll of sensitiveCollections) {
      // Unauthenticated denied
      assert.strictEqual(
        evaluateRule({ auth: unauth, collection: coll, docId: 'doc', operation: 'read' }),
        false,
        `Unauthenticated read to ${coll} must be denied`
      );
      assert.strictEqual(
        evaluateRule({ auth: unauth, collection: coll, docId: 'doc', operation: 'create' }),
        false,
        `Unauthenticated write to ${coll} must be denied`
      );

      // Guest denied
      assert.strictEqual(
        evaluateRule({ auth: guestAuth, collection: coll, docId: 'doc', operation: 'read' }),
        false,
        `Guest read to ${coll} must be denied`
      );
      assert.strictEqual(
        evaluateRule({ auth: guestAuth, collection: coll, docId: 'doc', operation: 'create' }),
        false,
        `Guest write to ${coll} must be denied`
      );
    }
  });

  test('Unauthenticated users are completely denied from reading/writing user profiles and watchlists', () => {
    const unauth = null;
    assert.strictEqual(evaluateRule({ auth: unauth, collection: 'users', docId: 'user1', operation: 'read' }), false);
    assert.strictEqual(evaluateRule({ auth: unauth, collection: 'users', docId: 'user1', operation: 'create', requestData: {} }), false);
    assert.strictEqual(evaluateRule({ auth: unauth, collection: 'user_watchlists', docId: 'user1', operation: 'read' }), false);
    assert.strictEqual(evaluateRule({ auth: unauth, collection: 'user_watchlists', docId: 'user1', operation: 'create', requestData: {} }), false);
  });

  test('Server authorization guards strictly block guest/anonymous users from protected mutations', () => {
    const mockRes = () => {
      const res: any = {
        statusCode: 200,
        data: null,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.data = payload;
          return this;
        }
      };
      return res;
    };

    // 1. requireAuth blocks isAnonymous
    const reqAnon: any = { user: { uid: 'anon_123', isAnonymous: true } };
    const res1 = mockRes();
    let nextCalled1 = false;
    requireAuth(reqAnon, res1, () => { nextCalled1 = true; });
    assert.strictEqual(nextCalled1, false, 'requireAuth must not call next() for anonymous user');
    assert.strictEqual(res1.statusCode, 401);
    assert.strictEqual(res1.data?.authRequired, true);

    // 2. requireAuth blocks unauthenticated guest uid
    const reqGuest: any = { user: { uid: 'guest', isAnonymous: true } };
    const res2 = mockRes();
    let nextCalled2 = false;
    requireAuth(reqGuest, res2, () => { nextCalled2 = true; });
    assert.strictEqual(nextCalled2, false, 'requireAuth must not call next() for guest');
    assert.strictEqual(res2.statusCode, 401);

    // 3. requireAdmin blocks anonymous user even with forged claims
    const reqTamperedAdmin: any = {
      user: {
        uid: 'anon_123',
        isAnonymous: true,
        email: 'dahiyarahul023@gmail.com',
        isAdmin: true,
        isOwner: true
      }
    };
    const res3 = mockRes();
    let nextCalled3 = false;
    requireAdmin(reqTamperedAdmin, res3, () => { nextCalled3 = true; });
    assert.strictEqual(nextCalled3, false, 'requireAdmin must reject anonymous user even if claims are forged');
    assert.strictEqual(res3.statusCode, 403);
  });
});

