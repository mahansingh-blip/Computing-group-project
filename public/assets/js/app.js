const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function setSession(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
}

function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = '/login.html';
  }
}

function nav() {
  const user = getUser();
  const commonLinks = `<a href="/products.html">Products</a><a href="/testing.html">Testing</a>`;
  const adminLink = user && user.role === 'ADMIN' ? '<a href="/admin.html">Admin Panel</a>' : '';
  const authLinks = user
    ? `${commonLinks}
       <a href="/dashboard.html">Dashboard</a>
       <a href="/cart.html">Cart</a>
       <a href="/orders.html">Orders</a>
       <a href="/notifications.html">Notifications</a>
       <a href="/profile.html">Profile</a>
       ${adminLink}
       <a href="#" id="logoutBtn">Logout</a>`
    : `${commonLinks}<a href="/login.html">Login</a><a href="/register.html">Register</a>`;

  return `
    <header class="topbar">
      <nav class="nav">
        <a class="brand" href="/" style="text-decoration:none; color:inherit;">StoreFlow</a>
        <div class="links">${authLinks}</div>
      </nav>
    </header>
  `;
}

function renderLayout(title, content) {
  const year = new Date().getFullYear();
  const footer = `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <div class="brand footer-brand">StoreFlow</div>
          <p>Modern online retail with fast browsing, secure checkout, and clear order tracking.</p>
        </div>
        <div>
          <h3>Quick Links</h3>
          <div class="footer-links">
            <a href="/products.html">Products</a>
            <a href="/orders.html">Orders</a>
            <a href="/checkout.html">Checkout</a>
            <a href="/admin.html">Admin</a>
            <a href="/testing.html">Testing Evidence</a>
            <a href="/api/docs" target="_blank" rel="noopener noreferrer">Swagger Docs</a>
          </div>
        </div>
        <div>
          <h3>Support</h3>
          <p>Email: support@storeflow.test</p>
          <p>Phone: +94 70 000 0000</p>
          <p>Hours: 24/7</p>
        </div>
      </div>
      <div class="footer-bottom">© ${year} StoreFlow. All rights reserved.</div>
    </footer>
  `;

  document.body.innerHTML = `${nav()}<main class="container"><h1>${title}</h1>${content}</main>${footer}`;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearSession();
      window.location.href = '/login.html';
    });
  }
}

function money(value) {
  const n = Number(value || 0);
  return `$${n.toFixed(2)}`;
}

function randomProductImage(product) {
  if (product && product.image_url) {
    return product.image_url;
  }

  const name = product && product.product_name ? String(product.product_name) : 'storeflow-product';
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  return `https://picsum.photos/seed/${encodeURIComponent(`store-${normalized}-${hash}`)}/640/420`;
}

window.app = {
  api,
  money,
  randomProductImage,
  getToken,
  setSession,
  getUser,
  clearSession,
  requireAuth,
  renderLayout
};
