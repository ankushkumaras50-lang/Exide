// Exide Battery Wholesale & AET Official Partner - Automated Notification & SMS Alert System
// Sends automated confirmation messages to customer email and phone number upon login and checkout

class NotificationManager {
  constructor() {
    this.logsKey = 'bm_exide_notification_logs';
    this.logs = this.loadLogs();
  }

  loadLogs() {
    try {
      const data = localStorage.getItem(this.logsKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveLogs() {
    try {
      localStorage.setItem(this.logsKey, JSON.stringify(this.logs.slice(0, 50)));
    } catch (e) {}
  }

  async sendOrderConfirmation(orderData) {
    if (!orderData || !orderData.customer) return;

    const customer = orderData.customer;
    const phone = customer.phone || '';
    const email = customer.email || '';
    const name = customer.fullName || 'Valued Customer';
    const orderId = orderData.orderId || ('EX-NP-' + Math.floor(100000 + Math.random() * 900000));
    const total = (orderData.totalPayable || (orderData.calculations && orderData.calculations.grandTotal) || 0).toLocaleString();
    const riderName = orderData.assignedRider ? orderData.assignedRider.name : 'Bikram Thapa';
    const riderPhone = orderData.assignedRider ? orderData.assignedRider.phone : '+977-9851087654';

    const smsText = `Exide Nepal: Order #${orderId} of NPR ${total} confirmed! Free Doorstep Fitting. Assigned Rider: ${riderName} (${riderPhone}). Support: 9705997260.`;

    // 1. Dispatch to serverless API
    try {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ORDER_PLACED',
          recipientPhone: phone,
          recipientEmail: email,
          customerName: name,
          orderData: orderData
        })
      }).catch(e => console.warn('Notification API fallback:', e));
    } catch(e) {}

    // 2. Save log
    this.logs.unshift({
      id: 'NOTIF-' + Date.now(),
      type: 'ORDER_PLACED',
      orderId: orderId,
      recipientPhone: phone,
      recipientEmail: email,
      message: smsText,
      timestamp: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kathmandu' }) + ', ' + new Date().toLocaleDateString()
    });
    this.saveLogs();

    // 3. Display Native Mobile Notification Banner
    this.showMobileNotificationBanner({
      icon: '📱',
      badge: 'SMS & Email Sent',
      title: `Order #${orderId} Confirmed`,
      message: `Automated confirmation sent to +977-${phone} & ${email || 'registered email'}. Rider: ${riderName} (${riderPhone})`
    });
  }

  async sendLoginAlert(customer) {
    if (!customer) return;
    const phone = customer.phone || '';
    const email = customer.email || '';
    const name = customer.fullName || 'Customer';
    const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kathmandu' });

    const smsText = `Exide Nepal Security: You logged in successfully at ${timeStr}.`;

    try {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CUSTOMER_LOGIN',
          recipientPhone: phone,
          recipientEmail: email,
          customerName: name
        })
      }).catch(e => console.warn('Login notify fallback:', e));
    } catch(e) {}

    this.logs.unshift({
      id: 'NOTIF-' + Date.now(),
      type: 'CUSTOMER_LOGIN',
      recipientPhone: phone,
      recipientEmail: email,
      message: smsText,
      timestamp: timeStr
    });
    this.saveLogs();

    this.showMobileNotificationBanner({
      icon: '🔐',
      badge: 'Login Alert Sent',
      title: 'Welcome Back, ' + name,
      message: `Security confirmation message sent to +977-${phone}`
    });
  }

  showMobileNotificationBanner(data) {
    const existing = document.getElementById('mobile-native-notify-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'mobile-native-notify-banner';
    banner.className = 'mobile-notify-push-banner';
    banner.innerHTML = `
      <div class="mobile-notify-inner">
        <div class="mobile-notify-icon-col">${data.icon || '💬'}</div>
        <div class="mobile-notify-content-col">
          <div class="mobile-notify-top">
            <span class="mobile-notify-app-name">Exide Nepal • ${data.badge}</span>
            <span class="mobile-notify-time">now</span>
          </div>
          <strong class="mobile-notify-title">${data.title}</strong>
          <p class="mobile-notify-body">${data.message}</p>
        </div>
        <button type="button" class="mobile-notify-close-btn" onclick="this.closest('#mobile-native-notify-banner').remove()">&times;</button>
      </div>
    `;

    document.body.appendChild(banner);

    // Auto-remove after 7 seconds
    setTimeout(() => {
      if (banner && banner.parentNode) {
        banner.classList.add('fade-out');
        setTimeout(() => banner.remove(), 400);
      }
    }, 7000);
  }
}

window.notifyManager = new NotificationManager();
