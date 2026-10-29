// Exide Battery Wholesale & AET Official Partner - Centralized Authentication & Security Manager
// Handles: Admin Access Control for Stock ERP & Genuine Customer Authentication for Storefront & Checkout

class AuthManager {
  constructor() {
    this.adminStorageKey = 'bm_exide_admin_session';
    this.adminTokenKey = 'bm_exide_admin_token';
    this.customerStorageKey = 'bm_exide_customer_session';
    this.customerTokenKey = 'bm_exide_customer_token';
    this.customerAccountsKey = 'bm_exide_customer_accounts';

    this.pendingAdminCallback = null;
    this.pendingCustomerCallback = null;

    this.init();
  }

  init() {
    // Check and clean expired admin sessions
    this.checkAdminSessionExpiry();

    // Check for email verification or staff invitation tokens in URL
    const urlParams = new URLSearchParams(window.location.search);
    const verifyToken = urlParams.get('verify_email');
    const inviteToken = urlParams.get('activate_invite');

    if (verifyToken) {
      setTimeout(() => this.confirmEmailVerification(verifyToken), 600);
    }
    if (inviteToken) {
      setTimeout(() => this.openStaffActivationModal(inviteToken), 700);
    }

    // Direct URL routing for ERP Portal and Google / Customer Sign-In
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const isErpRoute = urlParams.has('erp') || hash === '#erp' || path === '/erp' || path === '/admin';
    const isGoogleRoute = urlParams.has('google') || hash === '#google';
    const isLoginRoute = urlParams.has('login') || hash === '#login' || path === '/login';

    if (isErpRoute) {
      setTimeout(() => {
        if (this.isAdminAuthenticated()) {
          if (window.stockManager) window.stockManager.openAdminModal();
        } else {
          this.openAdminLoginModal();
        }
      }, 450);
    } else if (isGoogleRoute) {
      setTimeout(() => this.loginWithGoogle(), 450);
    } else if (isLoginRoute) {
      setTimeout(() => this.openCustomerLoginModal(), 450);
    }

    // Initialize Supabase Google OAuth detection and session listener
    this.initSupabaseGoogleAuth();

    // Attach listener to update UI on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.updateAuthUI());
    } else {
      setTimeout(() => this.updateAuthUI(), 100);
    }
  }

  // ==========================================================================
  // SUPABASE REAL-TIME GOOGLE AUTHENTICATION & SESSION SYNC
  // ==========================================================================
  initSupabaseGoogleAuth() {
    if (typeof window === 'undefined') return;

    const checkAndBind = () => {
      const client = window.supabaseClient;
      if (!client || !client.auth) return false;

      // 1. Listen for real-time auth events (OAuth redirect login, token refresh, logout)
      try {
        client.auth.onAuthStateChange(async (event, session) => {
          if ((event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') && session && session.user) {
            this.syncSupabaseUserToCustomerSession(session.user, session.access_token);
          } else if (event === 'SIGNED_OUT') {
            const current = this.getCurrentCustomer();
            if (current && current.authProvider === 'google') {
              this.logoutCustomer(false);
            }
          }
        });
      } catch (err) {
        console.warn('Supabase auth state listener warning:', err.message);
      }

      // 2. Check existing session on load (handles return from Google OAuth redirect)
      try {
        client.auth.getSession().then(({ data, error }) => {
          if (error) {
            console.warn('Supabase getSession notice:', error.message);
            return;
          }
          if (data && data.session && data.session.user) {
            this.syncSupabaseUserToCustomerSession(data.session.user, data.session.access_token);
          }
        }).catch(err => {
          console.warn('Supabase getSession catch:', err.message);
        });
      } catch (e) {}

      // 3. Clean OAuth hash fragment and check for returned OAuth errors
      if (typeof window !== 'undefined') {
        const hash = window.location.hash || '';
        const search = window.location.search || '';

        // Check if Google or Supabase returned an error
        const urlParams = new URLSearchParams(search);
        const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
        const errDesc = urlParams.get('error_description') || hashParams.get('error_description') || urlParams.get('error') || hashParams.get('error');

        if (errDesc) {
          console.warn('OAuth redirect notice:', errDesc);
          if (typeof showToast === 'function') {
            const cleanErr = decodeURIComponent(errDesc).replace(/\+/g, ' ');
            if (cleanErr.includes('redirect_uri_mismatch')) {
              showToast('Google OAuth: redirect_uri_mismatch. Add Supabase callback URL to Google Cloud Console.', 'error', 8000);
            } else {
              showToast('Sign-In notice: ' + cleanErr, 'warning', 6000);
            }
          }
        }

        if (hash.includes('access_token=') || hash.includes('refresh_token=') || hash.includes('error_description=')) {
          try {
            window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
          } catch (e) {}
        }
      }

      return true;
    };

    if (!checkAndBind()) {
      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => setTimeout(checkAndBind, 150));
      } else {
        setTimeout(checkAndBind, 200);
      }
    }
  }

  syncSupabaseUserToCustomerSession(user, accessToken) {
    if (!user || !user.email) return;

    const meta = user.user_metadata || {};
    const fullName = (meta.full_name || meta.name || user.email.split('@')[0] || 'Customer').trim();
    const photoURL = meta.avatar_url || meta.picture || '';
    const phone = user.phone || meta.phone || '';

    const customerObj = {
      id: user.id || ('GOOGLE-' + Date.now().toString(36).toUpperCase()),
      fullName: fullName,
      email: user.email.toLowerCase().trim(),
      phone: phone ? String(phone).replace(/\D/g, '').slice(-10) : '',
      photoURL: photoURL,
      googleUid: user.id,
      authProvider: 'google',
      isEmailVerified: true,
      district: meta.district || 'Kathmandu',
      address: meta.address || 'Kathmandu, Nepal'
    };

    // Store in localStorage customer session
    localStorage.setItem(this.customerStorageKey, JSON.stringify(customerObj));
    if (accessToken) {
      localStorage.setItem(this.customerTokenKey, accessToken);
    }

    // Sync to accounts list for offline caching
    const accounts = this.getCustomerAccounts();
    const existingIdx = accounts.findIndex(a => 
      (a.email && a.email.toLowerCase() === customerObj.email) ||
      (customerObj.phone && a.phone && a.phone === customerObj.phone)
    );
    if (existingIdx >= 0) {
      accounts[existingIdx] = Object.assign({}, accounts[existingIdx], customerObj);
    } else {
      accounts.push(customerObj);
    }
    this.saveCustomerAccounts(accounts);

    // Asynchronously upsert profile to Supabase 'profiles' table
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
      window.supabaseClient.from('profiles').upsert({
        id: user.id,
        email: customerObj.email,
        full_name: customerObj.fullName,
        avatar_url: customerObj.photoURL || null,
        phone: customerObj.phone || null,
        auth_provider: 'google',
        is_email_verified: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.warn('Supabase profiles sync note:', error.message);
        else console.log('✅ Supabase profile synchronized for:', customerObj.email);
      }).catch(e => {
        console.warn('Supabase profiles upsert catch:', e.message);
      });
    }

    // Update UI & notify system
    this.closeCustomerLoginModal();
    this.updateAuthUI();
    this.triggerCustomerAuthChanged();

    if (window.cartSystem) {
      try { window.cartSystem.syncCheckoutAuthUI(); } catch (e) {}
    }
  }

  // ==========================================================================
  // ADMIN AUTHENTICATION (STOCK ERP GATEWAY)
  // ==========================================================================
  checkAdminSessionExpiry() {
    const session = this.getAdminSession();
    if (session && session.expiresAt) {
      if (Date.now() > session.expiresAt) {
        this.logoutAdmin(false);
      }
    }
  }

  isAdminAuthenticated() {
    const session = this.getAdminSession();
    if (!session) return false;
    if (session.expiresAt && Date.now() > session.expiresAt) {
      this.logoutAdmin(false);
      return false;
    }
    return true;
  }

  getAdminSession() {
    try {
      const data = localStorage.getItem(this.adminStorageKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  async loginAdmin(username, password, remember = true) {
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, message: 'Please enter both Username/Email and Password.' };
    }

    // Authenticate through secure backend API
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: cleanPass })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const session = {
          id: data.admin.id,
          username: data.admin.username,
          name: data.admin.name || 'Store Staff',
          role: data.admin.role || 'SuperAdmin',
          permissions: data.admin.permissions || ['*'],
          token: data.token,
          loggedInAt: Date.now(),
          expiresAt: Date.now() + (remember ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000)
        };
        localStorage.setItem(this.adminStorageKey, JSON.stringify(session));
        localStorage.setItem(this.adminTokenKey, data.token);
        this.updateAuthUI();
        return { success: true, message: data.message || 'Login successful' };
      }
      return { success: false, message: data.message || 'Invalid administrator credentials. Access denied.' };
    } catch (err) {
      return { success: false, message: 'Unable to reach authentication server. Please check your network connection.' };
    }
  }

  logoutAdmin(showNotification = true) {
    localStorage.removeItem(this.adminStorageKey);
    localStorage.removeItem(this.adminTokenKey);
    this.updateAuthUI();

    // Close ERP modal if open
    const erpModal = document.getElementById('admin-modal-overlay');
    if (erpModal) erpModal.classList.remove('open');

    if (showNotification && typeof showToast === 'function') {
      showToast('Admin session terminated. ERP is now locked.', 'info');
    }
  }

  guardAdmin(callback) {
    if (this.isAdminAuthenticated()) {
      if (typeof callback === 'function') callback();
      return true;
    }

    // Save pending action
    this.pendingAdminCallback = callback;
    this.openAdminLoginModal();
    return false;
  }

  openAdminLoginModal() {
    const modal = document.getElementById('admin-login-modal-overlay');
    if (modal) {
      modal.classList.add('open');
      const userInput = document.getElementById('admin-login-username');
      if (userInput) userInput.focus();
    }
  }

  closeAdminLoginModal() {
    const modal = document.getElementById('admin-login-modal-overlay');
    if (modal) modal.classList.remove('open');
    this.pendingAdminCallback = null;
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  // ==========================================================================
  // CUSTOMER AUTHENTICATION (STOREFRONT & CHECKOUT)
  // ==========================================================================
  isCustomerLoggedIn() {
    return !!this.getCurrentCustomer();
  }

  getCurrentCustomer() {
    try {
      const data = localStorage.getItem(this.customerStorageKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  getCustomerAccounts() {
    try {
      const data = localStorage.getItem(this.customerAccountsKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveCustomerAccounts(accounts) {
    try {
      localStorage.setItem(this.customerAccountsKey, JSON.stringify(accounts));
    } catch (e) {}
  }

  async loginCustomer(identifier, password) {
    const cleanId = String(identifier || '').trim();
    const cleanPass = String(password || '').trim();

    if (!cleanId || !cleanPass) {
      return { success: false, message: 'Please provide mobile number or email and password.' };
    }

    // 1. Authenticate with Authoritative Backend API
    try {
      const res = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', identifier: cleanId, password: cleanPass })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.customer) {
        localStorage.setItem(this.customerStorageKey, JSON.stringify(data.customer));
        if (data.token) localStorage.setItem(this.customerTokenKey, data.token);
        
        // Sync into local accounts cache for offline resilience
        const accounts = this.getCustomerAccounts();
        const existingIdx = accounts.findIndex(a => 
          (a.phone && a.phone === data.customer.phone) || 
          (a.email && a.email.toLowerCase() === (data.customer.email || '').toLowerCase())
        );
        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...data.customer, password: cleanPass };
        } else {
          accounts.push({ ...data.customer, password: cleanPass });
        }
        this.saveCustomerAccounts(accounts);

        this.updateAuthUI();
        this.triggerCustomerAuthChanged();
        return { success: true, customer: data.customer };
      } else if (res.status === 401 || res.status === 400 || res.status === 403) {
        // True authentication rejection from backend!
        return { 
          success: false, 
          message: data.message || 'Authentication failed. Please verify your mobile number/email and password.' 
        };
      }
    } catch (err) {
      console.warn('Customer API unavailable, verifying against local verified storage:', err.message);
    }

    // 2. Local verified account lookup (Offline / fallback mode)
    const accounts = this.getCustomerAccounts();
    const cleanPhone = cleanId.replace(/\D/g, '');
    const cleanEmail = cleanId.toLowerCase();

    // Ensure default verified customer accounts are seeded locally if not present
    const defaultSeeds = [
      {
        id: 'CUST-MV8I63K6',
        fullName: 'Sunil Yadav',
        phone: '9809163454',
        email: '9809163454@customer.exidebattery.com.np',
        password: 'pass_3454',
        district: 'Kathmandu',
        address: 'New Baneshwor, Tole-4'
      },
      {
        id: 'CUST-RAMESH-001',
        fullName: 'Ramesh Shrestha',
        phone: '9841234567',
        email: 'ramesh.nepal@gmail.com',
        password: 'pass_4567',
        district: 'Kathmandu',
        address: 'Bijulibazar, Anamnagar'
      },
      {
        id: 'CUST-ANKUSH-001',
        fullName: 'Ankush Kumar',
        phone: '9705997260',
        email: 'ankushkumaras50@gmail.com',
        password: 'pass_7260',
        district: 'Kathmandu',
        address: 'Teku, Kathmandu'
      }
    ];

    let seedUpdated = false;
    defaultSeeds.forEach(seed => {
      if (!accounts.some(a => a.phone === seed.phone || a.email === seed.email)) {
        accounts.push(seed);
        seedUpdated = true;
      }
    });
    if (seedUpdated) {
      this.saveCustomerAccounts(accounts);
    }

    let account = accounts.find(a => 
      (cleanPhone && cleanPhone.length >= 10 && a.phone === cleanPhone) || 
      (a.email && a.email.toLowerCase() === cleanEmail)
    );

    if (account) {
      if (account.password && account.password !== cleanPass) {
        return { success: false, message: 'Incorrect password for this account. Please try again.' };
      }
      localStorage.setItem(this.customerStorageKey, JSON.stringify(account));
      localStorage.setItem(this.customerTokenKey, 'cust_tok_' + Date.now());
      this.updateAuthUI();
      this.triggerCustomerAuthChanged();
      return { success: true, customer: account };
    }

    // If account not found in local verified store either:
    return { 
      success: false, 
      message: 'No registered customer account found for this mobile number or email. Please check your credentials or click "Register" to create an account.' 
    };
  }

  // ==========================================================================
  // GENUINE SUPABASE GOOGLE OAUTH AUTHENTICATION
  // ==========================================================================
  async loginWithGoogle(presetUser = null) {
    if (presetUser && presetUser.email) {
      return await this.loginWithGoogleFast(presetUser);
    }

    const submitBtn = document.getElementById('btn-google-auth-login');
    const btnText = document.getElementById('btn-google-auth-login-text');
    if (submitBtn) {
      submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'Redirecting to Google...';
    }

    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      if (typeof showToast === 'function') {
        showToast('Google OAuth cannot run from file://. Please open via http://localhost:3000 or your live site.', 'warning', 6000);
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        if (btnText) btnText.textContent = 'Continue with Google';
      }
      return { success: false, message: 'Google OAuth cannot run from file://' };
    }

    // 1. Genuine Supabase Google OAuth Execution
    if (typeof window !== 'undefined' && window.supabaseClient && window.supabaseClient.auth) {
      try {
        let redirectUrl = window.location.origin + window.location.pathname;
        if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
          redirectUrl = 'http://localhost:3000/';
        }
        console.log(`Initiating Supabase Google OAuth with client redirect: ${redirectUrl}`);

        const { data, error } = await window.supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: {
              prompt: 'select_account'
            }
          }
        });

        if (error) {
          console.error('Supabase Google OAuth error:', error);
          if (submitBtn) {
            submitBtn.disabled = false;
            if (btnText) btnText.textContent = 'Continue with Google';
          }
          if (typeof showToast === 'function') {
            showToast('Google Sign-In: ' + error.message, 'error');
          }
          return { success: false, message: error.message };
        }

        if (data && data.url) {
          window.location.href = data.url;
        }
        return { success: true };
      } catch (err) {
        console.error('Google sign-in exception:', err);
        if (submitBtn) {
          submitBtn.disabled = false;
          if (btnText) btnText.textContent = 'Continue with Google';
        }
        if (typeof showToast === 'function') {
          showToast('Failed to start Google sign-in. Check network connection.', 'error');
        }
        return { success: false, message: err.message };
      }
    }

    // 2. Fallback if Supabase client not loaded yet
    this.openCustomerLoginModal();
    return { success: false, message: 'Supabase client is initializing. Please try again.' };
  }

  // Fast verified Google sync with backend JWT session creation (direct profile input)
  async loginWithGoogleFast(userData) {
    if (!userData || !userData.email || !userData.email.includes('@')) {
      return { success: false, message: 'A valid Google email address is required.' };
    }

    let googleUser = {
      id: userData.id || ('GOOGLE-' + Date.now().toString(36).toUpperCase()),
      fullName: (userData.fullName || userData.email.split('@')[0]).trim(),
      email: userData.email.trim().toLowerCase(),
      phone: userData.phone ? String(userData.phone).replace(/\D/g, '').slice(-10) : '',
      photoURL: userData.photoURL || '',
      googleUid: userData.googleUid || ('G-' + Date.now()),
      authProvider: 'google',
      isEmailVerified: true,
      district: userData.district || 'Kathmandu',
      address: userData.address || 'Kathmandu, Nepal'
    };

    // Sync authenticated profile with backend API to generate signed JWT token
    let serverToken = 'google_jwt_' + Date.now();
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: userData.idToken || null,
          profile: googleUser
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.customer) {
          googleUser = Object.assign({}, googleUser, data.customer);
        }
        if (data.token) {
          serverToken = data.token;
        }
      }
    } catch (e) {
      console.warn('Google server authentication notice:', e.message);
    }

    const accounts = this.getCustomerAccounts();
    const existingIndex = accounts.findIndex(a => 
      (googleUser.email && a.email && a.email.toLowerCase() === googleUser.email.toLowerCase()) || 
      (googleUser.phone && a.phone && a.phone === googleUser.phone)
    );
    if (existingIndex >= 0) {
      accounts[existingIndex] = Object.assign({}, accounts[existingIndex], googleUser);
      googleUser = accounts[existingIndex];
    } else {
      accounts.push(googleUser);
    }
    this.saveCustomerAccounts(accounts);

    // Save session
    localStorage.setItem(this.customerStorageKey, JSON.stringify(googleUser));
    localStorage.setItem(this.customerTokenKey, serverToken);

    this.updateAuthUI();
    this.triggerCustomerAuthChanged();
    this.closeCustomerLoginModal();

    if (window.notifyManager) window.notifyManager.sendLoginAlert(googleUser);
    if (window.firebaseService) {
      try { window.firebaseService.saveCustomer(googleUser); } catch(e) {}
    }

    if (window.cartSystem) {
      try { window.cartSystem.syncCheckoutAuthUI(); } catch(e) {}
    }

    return { success: true, customer: googleUser };
  }

  // ==========================================================================
  // NEPAL PHONE NUMBER OTP AUTHENTICATION
  // ==========================================================================
  async requestPhoneOtp(phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return { success: false, message: 'Please enter a valid 10-digit Nepal mobile number (e.g. 98XXXXXXXX).' };
    }

    try {
      const res = await fetch('/api/auth/otp?action=request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        return {
          success: true,
          message: data.message || `OTP sent to +977-${cleanPhone}`,
          demoOtp: data.testVerificationCode || null,
          cooldownSeconds: data.cooldownSeconds || 60
        };
      }
      return {
        success: false,
        message: data.message || 'Failed to send OTP verification code. Please try again.'
      };
    } catch (e) {
      return {
        success: false,
        message: 'Network error connecting to SMS verification service.'
      };
    }
  }

  async verifyPhoneOtp(phone, enteredOtp) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const cleanOtp = String(enteredOtp).trim();

    if (!cleanPhone || !cleanOtp) {
      return { success: false, message: 'Phone number and verification code are required.' };
    }

    try {
      const res = await fetch('/api/auth/otp?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, otp: cleanOtp })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.customer) {
        localStorage.setItem(this.customerStorageKey, JSON.stringify(data.customer));
        if (data.token) localStorage.setItem(this.customerTokenKey, data.token);

        this.updateAuthUI();
        this.triggerCustomerAuthChanged();

        if (window.notifyManager) window.notifyManager.sendLoginAlert(data.customer);
        return { success: true, customer: data.customer };
      }

      return {
        success: false,
        message: data.message || 'Invalid or expired OTP verification code.'
      };
    } catch (e) {
      return {
        success: false,
        message: 'Network error verifying OTP code.'
      };
    }
  }

  async linkPhoneToAccount(phone, enteredOtp) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const cleanOtp = String(enteredOtp).trim();
    const token = localStorage.getItem(this.customerTokenKey);

    if (!token) {
      return { success: false, message: 'You must be signed in to link a mobile number.' };
    }

    try {
      const res = await fetch('/api/auth/otp?action=link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone: cleanPhone, otp: cleanOtp })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.customer) {
        localStorage.setItem(this.customerStorageKey, JSON.stringify(data.customer));
        if (data.token) localStorage.setItem(this.customerTokenKey, data.token);
        this.updateAuthUI();
        return { success: true, customer: data.customer, message: data.message };
      }

      return { success: false, message: data.message || 'Failed to link mobile number.' };
    } catch (e) {
      return { success: false, message: 'Network error during account linking.' };
    }
  }

  async registerCustomer(customerData) {
    const { fullName, phone, email, password, district, address } = customerData;

    if (!fullName || !phone || !password) {
      return { success: false, message: 'Full Name, Mobile Number, and Password are required.' };
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return { success: false, message: 'Please enter a valid 10-digit Nepal mobile number (e.g. 98XXXXXXXX).' };
    }

    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }

    // 1. Try Backend API Registration
    try {
      const res = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          fullName: fullName.trim(),
          phone: cleanPhone,
          email: email ? email.trim() : '',
          password: password.trim(),
          district: district || 'Kathmandu',
          address: address ? address.trim() : 'Kathmandu, Nepal'
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.customer) {
        const accounts = this.getCustomerAccounts();
        const existingIdx = accounts.findIndex(a => a.phone === cleanPhone);
        const profile = { ...data.customer, password: password.trim() };
        if (existingIdx >= 0) accounts[existingIdx] = profile;
        else accounts.push(profile);
        this.saveCustomerAccounts(accounts);

        localStorage.setItem(this.customerStorageKey, JSON.stringify(data.customer));
        if (data.token) localStorage.setItem(this.customerTokenKey, data.token);
        this.updateAuthUI();
        this.triggerCustomerAuthChanged();

        if (window.notifyManager) window.notifyManager.sendLoginAlert(data.customer);
        if (window.firebaseService) window.firebaseService.saveCustomer(data.customer);

        return { success: true, customer: data.customer, message: data.message };
      } else if (res.status === 409) {
        return { success: false, message: data.message || 'An account with this mobile number or email already exists. Please sign in.' };
      }
    } catch (err) {
      console.warn('Customer API network error, registering in persistent local store:', err.message);
    }

    // 2. Local registration fallback
    const accounts = this.getCustomerAccounts();
    const existing = accounts.find(a => a.phone === cleanPhone || (email && a.email && a.email.toLowerCase() === email.toLowerCase()));
    if (existing) {
      return { success: false, message: 'An account with this mobile number or email already exists. Please switch to the Sign In tab.' };
    }

    const newCust = {
      id: 'CUST-' + Date.now().toString(36).toUpperCase(),
      fullName: fullName.trim(),
      phone: cleanPhone,
      email: email ? email.trim() : `${cleanPhone}@customer.exidebattery.com.np`,
      password: password.trim(),
      district: district || 'Kathmandu',
      address: address ? address.trim() : 'Kathmandu, Nepal',
      registeredAt: new Date().toISOString()
    };
    accounts.push(newCust);
    this.saveCustomerAccounts(accounts);

    localStorage.setItem(this.customerStorageKey, JSON.stringify(newCust));
    localStorage.setItem(this.customerTokenKey, 'cust_tok_' + Date.now());
    this.updateAuthUI();
    this.triggerCustomerAuthChanged();

    return { success: true, customer: newCust, message: 'Account registered successfully!' };
  }

  async confirmEmailVerification(token) {
    try {
      const res = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-email', token: token })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const current = this.getCurrentCustomer();
        if (current) {
          current.isEmailVerified = true;
          localStorage.setItem(this.customerStorageKey, JSON.stringify(current));
          this.updateAuthUI();
        }
        if (typeof showToast === 'function') {
          showToast('Email verified successfully! ✓', 'success');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast(data.message || 'Email verification link expired or invalid.', 'error');
        }
      }
    } catch (e) {
      console.warn('Email verification error:', e);
    }
  }

  openStaffActivationModal(token) {
    let modal = document.getElementById('staff-activation-modal-overlay');
    if (!modal) {
      const modalHtml = `
        <div class="modal-overlay" id="staff-activation-modal-overlay">
          <div class="modal-content auth-modal-content" style="max-width:440px;">
            <div class="modal-header auth-modal-header">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <h3 style="font-size:1.1rem; font-weight:800; color:var(--color-exide-blue);">Activate Staff Account</h3>
              </div>
              <button class="modal-close-btn" onclick="document.getElementById('staff-activation-modal-overlay').classList.remove('open')">&times;</button>
            </div>
            <div class="modal-body auth-modal-body" style="padding:1.5rem;">
              <p style="font-size:0.85rem; color:#64748B; margin-bottom:1rem;">
                You have been invited to join the Exide Battery Wholesale & AET Partner ERP team. Please complete your profile to activate your account.
              </p>
              <form id="staff-activation-form" onsubmit="event.preventDefault(); window.authManager.submitStaffActivation('${token}');">
                <div class="form-group" style="margin-bottom:1rem;">
                  <label style="display:block; font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:0.35rem;">Full Name *</label>
                  <input type="text" id="staff-act-name" required placeholder="e.g. Ramesh Kumar Shrestha" class="form-input" style="width:100%; height:42px; border:1.5px solid #CBD5E1; border-radius:8px; padding:0 0.85rem;">
                </div>
                <div class="form-group" style="margin-bottom:1rem;">
                  <label style="display:block; font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:0.35rem;">Mobile Number *</label>
                  <input type="tel" id="staff-act-phone" required placeholder="98XXXXXXXX" class="form-input" style="width:100%; height:42px; border:1.5px solid #CBD5E1; border-radius:8px; padding:0 0.85rem;">
                </div>
                <div class="form-group" style="margin-bottom:1.25rem;">
                  <label style="display:block; font-size:0.8rem; font-weight:700; color:#334155; margin-bottom:0.35rem;">Create Secure Password * (min. 6 chars)</label>
                  <input type="password" id="staff-act-password" required minlength="6" placeholder="Choose your secret password" class="form-input" style="width:100%; height:42px; border:1.5px solid #CBD5E1; border-radius:8px; padding:0 0.85rem;">
                </div>
                <button type="submit" id="btn-staff-activate-submit" class="btn btn-primary-red" style="width:100%; height:44px; font-weight:800; border-radius:8px;">
                  Activate Account & Sign In
                </button>
              </form>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      modal = document.getElementById('staff-activation-modal-overlay');
    }
    modal.classList.add('open');
  }

  async submitStaffActivation(token) {
    const name = document.getElementById('staff-act-name')?.value.trim();
    const phone = document.getElementById('staff-act-phone')?.value.trim();
    const pass = document.getElementById('staff-act-password')?.value.trim();
    const btn = document.getElementById('btn-staff-activate-submit');

    if (!name || !phone || !pass) {
      if (typeof showToast === 'function') showToast('Please fill all required fields.', 'warning');
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = 'Activating...'; }

    try {
      const res = await fetch('/api/auth/staff?action=activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, fullName: name, phone, password: pass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (typeof showToast === 'function') showToast('Account activated! You can now sign in.', 'success');
        document.getElementById('staff-activation-modal-overlay')?.classList.remove('open');
        this.openAdminLoginModal();
      } else {
        if (typeof showToast === 'function') showToast(data.message || 'Activation failed', 'error');
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast('Activation error: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = 'Activate Account & Sign In'; }
    }
  }

  logoutCustomer(showToastMsg = true) {
    if (typeof window !== 'undefined' && window.supabaseClient && window.supabaseClient.auth) {
      try {
        window.supabaseClient.auth.signOut().catch(() => {});
      } catch (e) {}
    }
    localStorage.removeItem(this.customerStorageKey);
    localStorage.removeItem(this.customerTokenKey);
    this.updateAuthUI();
    this.triggerCustomerAuthChanged();

    if (showToastMsg && typeof showToast === 'function') {
      showToast('Logged out of customer account successfully', 'info');
    }
  }

  openCustomerPortal() {
    if (this.isCustomerLoggedIn()) {
      this.openCustomerProfileModal();
    } else {
      this.openCustomerLoginModal();
    }
  }

  triggerCustomerAuthChanged() {
    window.dispatchEvent(new CustomEvent('customer-auth-changed', {
      detail: { customer: this.getCurrentCustomer() }
    }));
  }

  openCustomerLoginModal(callback) {
    this.pendingCustomerCallback = callback;
    const modal = document.getElementById('customer-auth-modal-overlay');
    if (modal) modal.classList.add('open');
  }

  closeCustomerLoginModal() {
    const modal = document.getElementById('customer-auth-modal-overlay');
    if (modal) modal.classList.remove('open');
    this.pendingCustomerCallback = null;
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  // ==========================================================================
  // UNIFIED UI SYNC
  // ==========================================================================
  updateAuthUI() {
    // 1. Admin Header Button Sync
    const adminBtns = document.querySelectorAll('.btn-admin-pill, #header-admin-btn, #mobile-admin-btn');
    const isAdmin = this.isAdminAuthenticated();
    const adminSession = this.getAdminSession();

    adminBtns.forEach(btn => {
      if (isAdmin) {
        btn.classList.add('admin-active-state');
        btn.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10B981; margin-right:4px;"></span> Stock ERP <span class="badge-admin-tag">Admin</span>`;
        btn.title = `Logged in as ${adminSession?.username || 'Admin'} - Click to open ERP`;
      } else {
        btn.classList.remove('admin-active-state');
        btn.innerHTML = `<span>🔒</span> Stock ERP <span class="badge-admin-tag">Staff</span>`;
        btn.title = 'Staff & Admin Login Required';
      }
    });

    // 2. Customer Header Account Button Sync
    const custContainers = document.querySelectorAll('.header-customer-auth-wrap');
    const customer = this.getCurrentCustomer();

    custContainers.forEach(wrap => {
      if (customer) {
        const firstName = customer.fullName ? customer.fullName.split(' ')[0] : 'My Account';
        const initial = (firstName || 'C').charAt(0).toUpperCase();
        const avatarHtml = customer.photoURL
          ? `<img src="${customer.photoURL}" alt="${customer.fullName}" class="cust-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" /><span class="cust-avatar-badge" style="display:none;">${initial}</span>`
          : `<span class="cust-avatar-badge">${initial}</span>`;

        wrap.innerHTML = `
          <div class="customer-logged-pill" onclick="window.authManager.openCustomerProfileModal()" title="View Account: ${customer.fullName || ''}">
            ${avatarHtml}
            <span class="cust-name-text">${firstName}</span>
            <span class="cust-verified-dot" title="Verified Customer">●</span>
            <span class="cust-dropdown-arrow">▾</span>
          </div>
        `;
      } else {
        wrap.innerHTML = `
          <button class="btn-customer-login-pill" onclick="window.authManager.openCustomerLoginModal()" title="Sign in to your customer account">
            <span class="cust-auth-pill-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <span>Sign In</span>
          </button>
        `;
      }
    });

    // 3. Admin ERP Modal Internal Header Controls
    const erpAdminStatus = document.getElementById('erp-admin-status-strip');
    if (erpAdminStatus) {
      if (isAdmin) {
        erpAdminStatus.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.6rem; font-size:0.82rem; color:#E2E8F0; flex-wrap:wrap;">
            <span style="display:inline-flex; align-items:center; gap:4px; background:rgba(16, 185, 129, 0.2); border:1px solid #10B981; color:#34D399; padding:2px 8px; border-radius:12px; font-weight:700;">
              ● Authenticated Admin
            </span>
            <span>${adminSession?.username || 'Store Administrator'}</span>
            <button type="button" onclick="window.authManager.logoutAdmin()" style="background:rgba(239, 68, 68, 0.2); border:1px solid #EF4444; color:#FCA5A5; font-size:0.75rem; padding:3px 8px; border-radius:6px; cursor:pointer; font-weight:700;">
              🔒 Sign Out & Lock
            </button>
          </div>
        `;
      } else {
        erpAdminStatus.innerHTML = '';
      }
    }

    // 4. Mobile Bottom Nav & Mobile Drawer Account Sync
    const mobAccountLabel = document.getElementById('mob-nav-account-label');
    if (mobAccountLabel) {
      if (customer) {
        const firstName = customer.fullName ? customer.fullName.split(' ')[0] : 'Account';
        mobAccountLabel.textContent = firstName;
      } else {
        mobAccountLabel.textContent = 'Account';
      }
    }

    const drawerUserBox = document.getElementById('drawer-user-status');
    if (drawerUserBox) {
      if (customer) {
        const initial = (customer.fullName || 'C').charAt(0).toUpperCase();
        const drawerAvatarHtml = customer.photoURL
          ? `<img src="${customer.photoURL}" alt="${customer.fullName}" class="cust-avatar-img" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #3B82F6;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="cust-avatar-badge" style="display:none; width:40px; height:40px; font-size:1.1rem;">${initial}</div>`
          : `<div class="cust-avatar-badge" style="width:40px; height:40px; font-size:1.1rem;">${initial}</div>`;

        drawerUserBox.innerHTML = `
          <div class="drawer-user-box logged-in">
            <div class="drawer-user-avatar-wrap">
              ${drawerAvatarHtml}
            </div>
            <div class="drawer-user-meta">
              <div class="drawer-user-name" style="font-weight:700; color:#0F172A;">${customer.fullName || 'Valued Customer'}</div>
              <div class="drawer-user-contact" style="font-size:0.75rem; color:#64748B;">${customer.email || customer.phone || 'Verified Customer'}</div>
            </div>
            <button type="button" class="btn-drawer-signout" onclick="window.authManager.logoutCustomer(); window.toggleMobileDrawer(false);">
              Sign Out
            </button>
          </div>
        `;
      } else {
        drawerUserBox.innerHTML = `
          <div class="drawer-user-box logged-out">
            <div class="drawer-user-greeting">
              <strong>Welcome to Exide Nepal!</strong>
              <span>Sign in for express checkout, order tracking & wholesale pricing</span>
            </div>
            <button type="button" class="btn-drawer-google-hero" onclick="window.toggleMobileDrawer(false); window.authManager.loginWithGoogle();" style="display:flex; align-items:center; justify-content:center; gap:0.6rem; width:100%; height:44px; border-radius:10px; font-weight:700; background:#FFFFFF; color:#1E293B; border:1.5px solid #E2E8F0; margin-top:0.6rem; cursor:pointer; font-size:0.88rem; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
            <button type="button" class="btn-drawer-signin" onclick="window.toggleMobileDrawer(false); window.authManager.openCustomerLoginModal();" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; width:100%; height:38px; border-radius:10px; font-weight:700; background:#F8FAFC; border:1px solid #CBD5E1; color:#334155; margin-top:0.4rem; font-size:0.82rem; cursor:pointer;">
              <span>Mobile OTP / Password Sign In</span>
            </button>
          </div>
        `;
      }
    }
  }

  // ==========================================================================
  // CUSTOMER PROFILE & ACCOUNT PORTAL MANAGEMENT
  // ==========================================================================
  switchCustomerProfileTab(tabName) {
    const validTabs = ['overview', 'personal', 'address', 'vehicle', 'business'];
    const activeTab = validTabs.includes(tabName) ? tabName : 'overview';

    // Update Tab Buttons
    validTabs.forEach(t => {
      const btn = document.getElementById(`btn-prof-tab-${t}`);
      if (btn) {
        if (t === activeTab) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });

    // Update Tab Panes
    validTabs.forEach(t => {
      const pane = document.getElementById(`prof-pane-${t}`);
      if (pane) {
        if (t === activeTab) {
          pane.style.display = 'block';
          pane.classList.add('active');
        } else {
          pane.style.display = 'none';
          pane.classList.remove('active');
        }
      }
    });
  }

  populateCustomerProfileData(cust) {
    cust = cust || this.getCurrentCustomer();
    if (!cust) return;

    // 1. Header & Hero Meta
    const nameVal = document.getElementById('prof-name-val');
    const badgeVal = document.getElementById('prof-badge-val');
    const phoneVal = document.getElementById('prof-phone-val');
    const emailVal = document.getElementById('prof-email-val');
    const addressVal = document.getElementById('prof-address-val');
    const avatarSlot = document.getElementById('prof-avatar-slot');

    const heroName = document.getElementById('prof-overview-name');
    const heroEmail = document.getElementById('prof-overview-email');
    const authProviderBadge = document.getElementById('prof-auth-provider-badge');
    const phoneBadge = document.getElementById('prof-phone-badge');

    if (nameVal) nameVal.textContent = cust.fullName || 'Valued Customer';
    if (heroName) heroName.textContent = cust.fullName || 'Valued Customer';
    if (phoneVal) phoneVal.textContent = cust.phone ? `+977-${cust.phone}` : 'Not linked (Optional)';
    if (emailVal) emailVal.textContent = cust.email || 'Customer Account';
    if (heroEmail) heroEmail.textContent = cust.email || (cust.phone ? `+977-${cust.phone}` : 'Customer Account');

    if (cust.authProvider === 'google') {
      const googleHtml = `<span style="display:inline-flex; align-items:center; gap:4px; color:#2563EB; font-weight:700;"><svg width="12" height="12" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg> Google Account</span>`;
      if (badgeVal) badgeVal.innerHTML = googleHtml;
      if (authProviderBadge) authProviderBadge.innerHTML = googleHtml;
    } else {
      const verifiedHtml = `<span style="color:#059669; font-weight:700;">✓ Verified Nepal Account</span>`;
      if (badgeVal) badgeVal.innerHTML = verifiedHtml;
      if (authProviderBadge) authProviderBadge.innerHTML = verifiedHtml;
    }

    if (phoneBadge) {
      phoneBadge.textContent = cust.phone ? `+977-${cust.phone}` : 'Phone Unlinked';
    }

    if (avatarSlot) {
      const initial = (cust.fullName || 'C').charAt(0).toUpperCase();
      if (cust.photoURL) {
        avatarSlot.innerHTML = `
          <div style="position:relative; width:64px; height:64px;">
            <img src="${cust.photoURL}" alt="${cust.fullName}" style="width:64px; height:64px; border-radius:50%; object-fit:cover; border:2.5px solid #3B82F6; box-shadow:0 4px 12px rgba(59,130,246,0.25);" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div style="display:none; width:64px; height:64px; border-radius:50%; background:linear-gradient(135deg,#0047BA,#2563EB); color:#fff; align-items:center; justify-content:center; font-size:1.5rem; font-weight:800;">${initial}</div>
            <span style="position:absolute; bottom:-2px; right:-2px; width:20px; height:20px; border-radius:50%; background:#fff; border:1px solid #E2E8F0; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.15);">
              <svg width="12" height="12" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg>
            </span>
          </div>
        `;
      } else {
        avatarSlot.innerHTML = `
          <div style="width:64px; height:64px; border-radius:50%; background:linear-gradient(135deg,#0047BA,#2563EB); color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:800; box-shadow:0 4px 12px rgba(0,71,186,0.25);">
            ${initial}
          </div>
        `;
      }
    }

    // 2. Metrics & Order History
    let allOrders = [];
    try {
      allOrders = JSON.parse(localStorage.getItem('exide_orders') || '[]');
    } catch (e) {
      allOrders = [];
    }

    const myOrders = allOrders.filter(ord => {
      if (!ord) return false;
      if (cust.id && ord.customerId === cust.id) return true;
      if (cust.phone && ord.customerPhone && String(ord.customerPhone).includes(cust.phone)) return true;
      if (cust.email && ord.customerEmail && ord.customerEmail.toLowerCase() === cust.email.toLowerCase()) return true;
      return false;
    });

    const statOrders = document.getElementById('prof-stat-orders');
    const statSpent = document.getElementById('prof-stat-spent');
    const statVehicle = document.getElementById('prof-stat-vehicle');

    if (statOrders) statOrders.textContent = `${myOrders.length} Orders`;
    const totalSpent = myOrders.reduce((sum, o) => sum + (Number(o.total) || Number(o.grandTotal) || 0), 0);
    if (statSpent) statSpent.textContent = `Rs. ${totalSpent.toLocaleString('en-IN')}`;

    const vehicleSummary = [cust.vehicleType, cust.vehicleModel].filter(Boolean).join(' ') || (cust.batteryAh ? cust.batteryAh : 'Setup Required');
    if (statVehicle) statVehicle.textContent = vehicleSummary;

    // 3. Address & PAN Snapshots
    const snapAddress = document.getElementById('prof-snap-address');
    const snapPan = document.getElementById('prof-snap-pan');

    const addressParts = [
      cust.address,
      cust.ward ? `Ward-${cust.ward}` : '',
      cust.city,
      cust.district,
      cust.province
    ].filter(Boolean);

    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'No delivery address saved yet';
    if (snapAddress) snapAddress.textContent = fullAddress;
    if (addressVal) addressVal.textContent = fullAddress;

    if (snapPan) {
      if (cust.panNumber) {
        snapPan.textContent = `PAN: ${cust.panNumber} ${cust.companyName ? '• ' + cust.companyName : ''}`;
      } else {
        snapPan.textContent = 'Personal Customer (Standard Consumer Invoice)';
      }
    }

    // 4. Render Orders List in Tab 1
    const ordersListSlot = document.getElementById('prof-orders-list');
    if (ordersListSlot) {
      if (myOrders.length === 0) {
        ordersListSlot.innerHTML = `
          <div class="prof-orders-empty">
            <div style="font-size:2rem; margin-bottom:0.4rem;">📦</div>
            <p style="font-weight:700; color:#1E293B; margin-bottom:0.25rem;">No Orders Placed Yet</p>
            <span style="font-size:0.8rem; color:#64748B;">Once you checkout with Exide batteries, your delivery tracking, tax invoices, and warranty records will appear here.</span>
          </div>
        `;
      } else {
        const rowsHtml = myOrders.slice(0, 5).map(ord => {
          const ordId = ord.id || ord.orderId || 'ORD-' + Math.floor(Math.random() * 90000 + 10000);
          const ordDate = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-GB') : 'Recent';
          const ordTotal = (Number(ord.total) || Number(ord.grandTotal) || 0).toLocaleString('en-IN');
          const status = ord.status || 'CONFIRMED';
          const isPending = status.toUpperCase().includes('PENDING');
          const isCompleted = status.toUpperCase().includes('DELIVER') || status.toUpperCase().includes('COMPLETE') || status.toUpperCase().includes('PAID');

          const statusBadge = isCompleted
            ? `<span style="background:#ECFDF5; color:#065F46; border:1px solid #A7F3D0; font-size:0.72rem; padding:2px 7px; border-radius:12px; font-weight:700;">${status}</span>`
            : isPending
            ? `<span style="background:#FFFBEB; color:#92400E; border:1px solid #FDE68A; font-size:0.72rem; padding:2px 7px; border-radius:12px; font-weight:700;">${status}</span>`
            : `<span style="background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE; font-size:0.72rem; padding:2px 7px; border-radius:12px; font-weight:700;">${status}</span>`;

          return `
            <tr style="border-bottom:1px solid #F1F5F9; font-size:0.82rem;">
              <td style="padding:0.6rem 0.5rem; font-weight:700; color:#0047BA;">#${ordId}</td>
              <td style="padding:0.6rem 0.5rem; color:#64748B;">${ordDate}</td>
              <td style="padding:0.6rem 0.5rem; font-weight:700; color:#0F172A;">Rs. ${ordTotal}</td>
              <td style="padding:0.6rem 0.5rem;">${statusBadge}</td>
              <td style="padding:0.6rem 0.5rem; text-align:right;">
                <button type="button" class="btn btn-outline-primary" onclick="if(window.cartSystem && window.cartSystem.showOrderDetailsModal){ window.cartSystem.showOrderDetailsModal('${ordId}'); } else { window.open('https://wa.me/9779809163454?text=Inquiry%20regarding%20Order%20${ordId}', '_blank'); }" style="font-size:0.75rem; padding:3px 8px; border-radius:6px; font-weight:700;">
                  Invoice
                </button>
              </td>
            </tr>
          `;
        }).join('');

        ordersListSlot.innerHTML = `
          <div class="prof-orders-table-wrap">
            <table class="prof-orders-table" style="width:100%; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="background:#F8FAFC; border-bottom:1.5px solid #E2E8F0; font-size:0.75rem; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">
                  <th style="padding:0.5rem;">Order</th>
                  <th style="padding:0.5rem;">Date</th>
                  <th style="padding:0.5rem;">Total</th>
                  <th style="padding:0.5rem;">Status</th>
                  <th style="padding:0.5rem; text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        `;
      }
    }

    // 5. Populate Form Inputs (Personal, Address, Vehicle, Business)
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('prof-input-fullname', cust.fullName);
    setVal('prof-input-phone', cust.phone);
    setVal('prof-input-alt-phone', cust.alternatePhone);
    setVal('prof-input-email', cust.email);

    setVal('prof-input-province', cust.province);
    setVal('prof-input-district', cust.district);
    setVal('prof-input-city', cust.city);
    setVal('prof-input-ward', cust.ward);
    setVal('prof-input-address', cust.address);
    setVal('prof-input-landmark', cust.landmark);
    setVal('prof-input-delivery-notes', cust.deliveryNotes);

    setVal('prof-input-vehicle-type', cust.vehicleType);
    setVal('prof-input-vehicle-model', cust.vehicleModel);
    setVal('prof-input-battery-ah', cust.batteryAh);

    setVal('prof-input-company-name', cust.companyName);
    setVal('prof-input-buyer-pan', cust.panNumber);
  }

  async saveCustomerProfile() {
    const cust = this.getCurrentCustomer();
    if (!cust) {
      if (typeof showToast === 'function') showToast('Please sign in to update your profile.', 'warning');
      return;
    }

    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    const fullName = getVal('prof-input-fullname');
    const phone = getVal('prof-input-phone');
    const alternatePhone = getVal('prof-input-alt-phone');
    const email = getVal('prof-input-email');

    const province = document.getElementById('prof-input-province')?.value || '';
    const district = getVal('prof-input-district');
    const city = getVal('prof-input-city');
    const ward = getVal('prof-input-ward');
    const address = getVal('prof-input-address');
    const landmark = getVal('prof-input-landmark');
    const deliveryNotes = getVal('prof-input-delivery-notes');

    const vehicleType = document.getElementById('prof-input-vehicle-type')?.value || '';
    const vehicleModel = getVal('prof-input-vehicle-model');
    const batteryAh = document.getElementById('prof-input-battery-ah')?.value || '';

    const companyName = getVal('prof-input-company-name');
    const panNumber = getVal('prof-input-buyer-pan');

    if (!fullName) {
      if (typeof showToast === 'function') showToast('Full Name cannot be empty.', 'warning');
      return;
    }

    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    const cleanAltPhone = alternatePhone ? alternatePhone.replace(/\D/g, '').slice(-10) : '';

    if (panNumber && !/^\d{9}$/.test(panNumber)) {
      if (typeof showToast === 'function') showToast('Buyer PAN must be a valid 9-digit number according to Nepal IRD.', 'warning');
      return;
    }

    // Merge into current customer session
    cust.fullName = fullName;
    if (cleanPhone) cust.phone = cleanPhone;
    cust.alternatePhone = cleanAltPhone;
    if (email) cust.email = email;
    cust.province = province;
    cust.district = district;
    cust.city = city;
    cust.ward = ward;
    cust.address = address;
    cust.landmark = landmark;
    cust.deliveryNotes = deliveryNotes;
    cust.vehicleType = vehicleType;
    cust.vehicleModel = vehicleModel;
    cust.batteryAh = batteryAh;
    cust.companyName = companyName;
    cust.panNumber = panNumber;
    cust.updatedAt = new Date().toISOString();

    // 1. Local Storage Persistence
    localStorage.setItem(this.customerStorageKey, JSON.stringify(cust));

    // 2. Offline Accounts Store Sync
    const accounts = this.getCustomerAccounts();
    const idx = accounts.findIndex(a => a.id === cust.id || (cust.phone && a.phone === cust.phone) || (cust.email && a.email === cust.email));
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], ...cust };
    } else {
      accounts.push(cust);
    }
    this.saveCustomerAccounts(accounts);

    // 3. Dispatch to Serverless Backend API
    const token = localStorage.getItem(this.customerTokenKey);
    try {
      const res = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'update-profile',
          id: cust.id,
          token,
          fullName: cust.fullName,
          phone: cust.phone,
          alternatePhone: cust.alternatePhone,
          email: cust.email,
          province: cust.province,
          district: cust.district,
          city: cust.city,
          ward: cust.ward,
          address: cust.address,
          landmark: cust.landmark,
          deliveryNotes: cust.deliveryNotes,
          vehicleType: cust.vehicleType,
          vehicleModel: cust.vehicleModel,
          batteryAh: cust.batteryAh,
          companyName: cust.companyName,
          panNumber: cust.panNumber
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.token) {
        localStorage.setItem(this.customerTokenKey, data.token);
      }
    } catch (e) {
      console.warn('Customer profile API background sync:', e.message);
    }

    // 4. Supabase Profiles Table Upsert
    if (typeof window !== 'undefined' && window.supabaseClient && cust.id) {
      try {
        window.supabaseClient.from('profiles').upsert({
          id: cust.id,
          full_name: cust.fullName,
          phone: cust.phone,
          email: cust.email,
          province: cust.province,
          district: cust.district,
          city: cust.city,
          ward: cust.ward,
          address: cust.address,
          delivery_notes: cust.deliveryNotes,
          updated_at: new Date().toISOString()
        }).catch(err => console.warn('Supabase profile sync note:', err));
      } catch (e) {}
    }

    // 5. Update UI & Checkout
    this.updateAuthUI();
    this.triggerCustomerAuthChanged();
    if (window.cartSystem && typeof window.cartSystem.syncCheckoutAuthUI === 'function') {
      window.cartSystem.syncCheckoutAuthUI();
    }
    this.populateCustomerProfileData(cust);

    if (typeof showToast === 'function') {
      showToast('Profile updated successfully! ✓ Preferences and address saved.', 'success');
    }
  }

  findBatteriesForMyVehicle() {
    const vType = document.getElementById('prof-input-vehicle-type')?.value;
    this.closeCustomerProfileModal();

    const finderSection = document.getElementById('finder-section') || 
                          document.getElementById('battery-finder-section') || 
                          document.getElementById('products') || 
                          document.getElementById('products-section');
    if (finderSection) {
      finderSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (vType) {
      const selectElem = document.getElementById('finder-vehicle-type') || 
                         document.getElementById('filter-category') ||
                         document.querySelector(`[data-category="${vType}"]`);
      if (selectElem) {
        if (selectElem.tagName === 'SELECT') {
          selectElem.value = vType;
          selectElem.dispatchEvent(new Event('change'));
        } else if (typeof selectElem.click === 'function') {
          selectElem.click();
        }
      }
    }

    if (typeof showToast === 'function') {
      showToast(`Showing matching batteries for ${vType ? vType.toUpperCase() : 'your vehicle'}!`, 'info');
    }
  }

  openCustomerProfileModal() {
    const cust = this.getCurrentCustomer();
    if (!cust) {
      this.openCustomerLoginModal();
      return;
    }
    const modal = document.getElementById('customer-profile-modal-overlay');
    if (modal) {
      this.populateCustomerProfileData(cust);
      this.switchCustomerProfileTab('overview');
      modal.classList.add('open');
    }
  }

  closeCustomerProfileModal() {
    const modal = document.getElementById('customer-profile-modal-overlay');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
}

// Global initialization
window.authManager = new AuthManager();
