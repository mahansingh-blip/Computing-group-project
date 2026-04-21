CREATE DATABASE IF NOT EXISTS online_retail;
USE online_retail;

CREATE TABLE roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE users (
  user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(25),
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE addresses (
  address_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  label VARCHAR(50),
  recipient_name VARCHAR(150) NOT NULL,
  line1 VARCHAR(255) NOT NULL,
  line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE categories (
  category_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  product_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  product_name VARCHAR(180) NOT NULL,
  description TEXT,
  unit_price DECIMAL(10,2) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE carts (
  cart_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE cart_items (
  cart_item_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  cart_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  unit_price_snapshot DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(product_id),
  CONSTRAINT uq_cart_product UNIQUE (cart_id, product_id),
  CONSTRAINT chk_cart_quantity CHECK (quantity > 0)
);

CREATE TABLE orders (
  order_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  address_id BIGINT,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  order_status ENUM('PENDING','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  placed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_orders_address FOREIGN KEY (address_id) REFERENCES addresses(address_id)
);

CREATE TABLE order_items (
  order_item_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(product_id),
  CONSTRAINT chk_order_item_quantity CHECK (quantity > 0)
);

CREATE TABLE payments (
  payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  payment_method ENUM('CARD','BANK_TRANSFER','COD','EWALLET') NOT NULL,
  payment_status ENUM('INITIATED','SUCCESS','FAILED','REFUNDED') NOT NULL DEFAULT 'INITIATED',
  provider_txn_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  order_id BIGINT,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  notification_type ENUM('ORDER_UPDATE','PAYMENT','PROMOTION','SYSTEM') NOT NULL DEFAULT 'SYSTEM',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

INSERT INTO roles (role_name) VALUES ('ADMIN'), ('CUSTOMER');

INSERT INTO users (role_id, first_name, last_name, email, phone, password_hash, is_active)
SELECT r.role_id, 'Admin', 'User', 'admin@storeflow.test', '0710000000',
       '$2a$10$d6fUFLstxfSIDXCqNzfKIel0wJeaQ.pQVOjPukznU023C76I7ldmK', 1
FROM roles r
WHERE r.role_name = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'admin@storeflow.test'
  );

INSERT INTO users (role_id, first_name, last_name, email, phone, password_hash, is_active)
SELECT r.role_id, 'Test', 'Customer', 'user@storeflow.test', '0720000000',
       '$2a$10$HjYZjDUI7jfnWHiEDX0YBuxn0q8UepJ3SCEc.MlsMUalQ3C5oR/mm', 1
FROM roles r
WHERE r.role_name = 'CUSTOMER'
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'user@storeflow.test'
  );

INSERT INTO carts (user_id)
SELECT u.user_id
FROM users u
WHERE u.email IN ('admin@storeflow.test', 'user@storeflow.test')
  AND NOT EXISTS (
    SELECT 1 FROM carts c WHERE c.user_id = u.user_id
  );

INSERT INTO categories (category_name, description) VALUES
('Electronics', 'Phones, laptops, and gadgets'),
('Fashion', 'Clothing and accessories'),
('Home', 'Furniture and home essentials');

INSERT INTO products (category_id, sku, product_name, description, unit_price, stock_quantity, image_url) VALUES
(1, 'ELEC-001', 'Wireless Headphones', 'Noise-cancelling over-ear headphones', 89.99, 120, NULL),
(1, 'ELEC-002', 'Smart Watch', 'Fitness and activity tracking smartwatch', 129.99, 75, NULL),
(2, 'FASH-001', 'Classic T-Shirt', '100% cotton unisex t-shirt', 19.99, 200, NULL),
(3, 'HOME-001', 'Desk Lamp', 'LED desk lamp with adjustable brightness', 34.50, 90, NULL),
(1, 'ELEC-003', 'Bluetooth Speaker', 'Portable speaker with deep bass output', 59.99, 110, NULL),
(1, 'ELEC-004', 'Gaming Mouse', 'High-precision RGB gaming mouse', 39.99, 140, NULL),
(1, 'ELEC-005', 'Mechanical Keyboard', 'Compact keyboard with tactile switches', 74.99, 95, NULL),
(1, 'ELEC-006', 'USB-C Charger', '65W fast charger for phones and laptops', 29.99, 180, NULL),
(1, 'ELEC-007', '1080p Webcam', 'Full HD webcam with built-in microphone', 49.99, 85, NULL),
(1, 'ELEC-008', 'External SSD 1TB', 'High-speed portable solid state drive', 119.99, 70, NULL),
(2, 'FASH-002', 'Denim Jacket', 'Classic fit denim jacket for all seasons', 64.99, 100, NULL),
(2, 'FASH-003', 'Running Sneakers', 'Lightweight sneakers for daily training', 79.99, 130, NULL),
(2, 'FASH-004', 'Leather Wallet', 'Slim wallet with multiple card slots', 24.99, 160, NULL),
(2, 'FASH-005', 'Casual Hoodie', 'Soft fleece hoodie with front pocket', 44.99, 145, NULL),
(2, 'FASH-006', 'Aviator Sunglasses', 'UV-protected polarized sunglasses', 29.50, 125, NULL),
(2, 'FASH-007', 'Cotton Chinos', 'Comfort stretch chinos for daily wear', 39.90, 115, NULL),
(3, 'HOME-002', 'Ergonomic Office Chair', 'Adjustable chair with lumbar support', 149.99, 60, NULL),
(3, 'HOME-003', 'Coffee Maker', 'Programmable drip coffee machine', 69.99, 88, NULL),
(3, 'HOME-004', 'Air Purifier', 'HEPA purifier for clean indoor air', 129.00, 72, NULL),
(3, 'HOME-005', 'Storage Organizer', 'Multi-compartment shelf organizer', 54.99, 94, NULL),
(3, 'HOME-006', 'Kitchen Knife Set', 'Stainless steel 6-piece knife set', 45.75, 105, NULL),
(3, 'HOME-007', 'Memory Foam Pillow', 'Breathable pillow for neck support', 32.99, 150, NULL),
(3, 'HOME-008', 'Floor Rug', 'Soft woven rug for living spaces', 58.40, 92, NULL);
