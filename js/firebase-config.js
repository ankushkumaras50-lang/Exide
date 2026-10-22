// Exide Battery Wholesale & AET Official Partner - Firebase WebApp Integration
// Handles: Cloud Firestore Database Sync, Firebase Authentication, and Offline-First Persistence

(function() {
  'use strict';

  // Default Firebase configuration for Exide Battery Wholesale Production WebApp
  // Users can easily override this via window.__EXIDE_FIREBASE_CONFIG__ if connecting their own project
  const defaultConfig = {
    apiKey: "AIzaSyD_ExideBatteryWholesaleNepalPartnerKey2026",
    authDomain: "exide-battery-wholesale.firebaseapp.com",
    projectId: "exide-battery-wholesale-np",
    storageBucket: "exide-battery-wholesale-np.appspot.com",
    messagingSenderId: "847291039485",
    appId: "1:847291039485:web:7f6a5b4c3d2e1a0b"
  };

  const config = window.__EXIDE_FIREBASE_CONFIG__ || defaultConfig;

  class FirebaseService {
    constructor() {
      this.isInitialized = false;
      this.app = null;
      this.auth = null;
      this.db = null;
      this.localCollections = {
        orders: 'bm_exide_firebase_orders',
        customers: 'bm_exide_firebase_customers',
        logistics_crew: 'bm_exide_logistics_crew',
        inventory: 'bm_exide_stock_inventory'
      };

      this.init();
    }

    init() {
      try {
        if (typeof firebase !== 'undefined' && firebase.initializeApp) {
          if (!firebase.apps.length) {
            this.app = firebase.initializeApp(config);
          } else {
            this.app = firebase.app();
          }

          if (firebase.auth) this.auth = firebase.auth();
          if (firebase.firestore) {
            this.db = firebase.firestore();
            try {
              // Enable offline persistence if supported
              this.db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
            } catch(e) {}
          }
          this.isInitialized = true;
          console.log('✅ Firebase initialized successfully for Exide Battery WebApp');
        } else {
          console.log('⚡ Running in Firebase Hybrid Offline-Ready Mode');
        }
      } catch (err) {
        console.warn('Firebase init warning (using persistent local database):', err.message);
      }
    }

    // ----------------------------------------------------
    // ORDERS COLLECTION
    // ----------------------------------------------------
    async saveOrder(order) {
      if (!order || !order.orderId) return;

      // 1. Local Cache Mirror
      try {
        const cached = this.getCollectionLocal('orders');
        const existingIdx = cached.findIndex(o => o.orderId === order.orderId);
        if (existingIdx >= 0) cached[existingIdx] = order;
        else cached.unshift(order);
        localStorage.setItem(this.localCollections.orders, JSON.stringify(cached));
      } catch (e) {}

      // 2. Cloud Firestore Sync
      if (this.db) {
        try {
          await this.db.collection('orders').doc(order.orderId).set({
            ...order,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.warn('Firestore order sync warning:', err.message);
        }
      }
    }

    async getOrders() {
      if (this.db) {
        try {
          const snapshot = await this.db.collection('orders').orderBy('orderDate', 'desc').limit(100).get();
          if (!snapshot.empty) {
            return snapshot.docs.map(doc => doc.data());
          }
        } catch (e) {}
      }
      return this.getCollectionLocal('orders');
    }

    // ----------------------------------------------------
    // LOGISTICS CREW COLLECTION
    // ----------------------------------------------------
    async saveLogisticsCrew(crewList) {
      if (!Array.isArray(crewList)) return;
      try {
        localStorage.setItem(this.localCollections.logistics_crew, JSON.stringify(crewList));
      } catch(e) {}

      if (this.db) {
        try {
          const batch = this.db.batch();
          crewList.forEach(rider => {
            const docRef = this.db.collection('logistics_crew').doc(rider.id);
            batch.set(docRef, { ...rider, updatedAt: new Date().toISOString() }, { merge: true });
          });
          await batch.commit();
        } catch(e) {}
      }
    }

    async getLogisticsCrew() {
      if (this.db) {
        try {
          const snapshot = await this.db.collection('logistics_crew').get();
          if (!snapshot.empty) {
            return snapshot.docs.map(doc => doc.data());
          }
        } catch (e) {}
      }
      return this.getCollectionLocal('logistics_crew');
    }

    // ----------------------------------------------------
    // CUSTOMER PROFILES COLLECTION
    // ----------------------------------------------------
    async saveCustomer(customer) {
      if (!customer || !customer.phone) return;
      try {
        const list = this.getCollectionLocal('customers');
        const idx = list.findIndex(c => c.phone === customer.phone);
        if (idx >= 0) list[idx] = customer;
        else list.push(customer);
        localStorage.setItem(this.localCollections.customers, JSON.stringify(list));
      } catch(e) {}

      if (this.db) {
        try {
          await this.db.collection('customers').doc(customer.phone).set({
            ...customer,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {}
      }
    }

    // Utility for local storage
    getCollectionLocal(key) {
      try {
        const val = localStorage.getItem(this.localCollections[key] || key);
        return val ? JSON.parse(val) : [];
      } catch(e) {
        return [];
      }
    }
  }

  window.firebaseService = new FirebaseService();
})();
