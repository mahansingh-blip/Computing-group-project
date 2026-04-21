const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }

    return cb(null, true);
  }
});

router.get('/', async (req, res) => {
  try {
    const { category, q, minPrice, maxPrice, inStock, sort, includeInactive } = req.query;
    const params = [];
    const conditions = [];
    const sortMap = {
      newest: 'p.created_at DESC',
      price_asc: 'p.unit_price ASC',
      price_desc: 'p.unit_price DESC',
      name_asc: 'p.product_name ASC',
      name_desc: 'p.product_name DESC'
    };

    if (includeInactive !== '1') {
      conditions.push('p.is_active = 1');
    }

    if (category) {
      conditions.push('c.category_name = ?');
      params.push(category);
    }

    if (q) {
      conditions.push('(p.product_name LIKE ? OR p.description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    if (minPrice) {
      conditions.push('p.unit_price >= ?');
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      conditions.push('p.unit_price <= ?');
      params.push(Number(maxPrice));
    }

    if (inStock === '1') {
      conditions.push('p.stock_quantity > 0');
    }

    const orderBy = sortMap[sort] || sortMap.newest;

    const query = `
      SELECT p.product_id, p.sku, p.product_name, p.description, p.unit_price, p.stock_quantity, p.image_url,
             c.category_name, p.is_active
      FROM products p
      JOIN categories c ON c.category_id = p.category_id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY ${orderBy}
    `;

    const [rows] = await pool.query(query, params);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
          `SELECT p.product_id, p.sku, p.product_name, p.description, p.unit_price, p.stock_quantity, p.image_url,
            c.category_name, p.is_active
       FROM products p
       JOIN categories c ON c.category_id = p.category_id
       WHERE p.product_id = ? AND p.is_active = 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
});

router.post('/', authRequired, requireRole('ADMIN'), upload.single('imageFile'), async (req, res) => {
  try {
    const { categoryId, sku, productName, description, unitPrice, stockQuantity, imageUrl } = req.body;
    const uploadedImageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!categoryId || !sku || !productName || !unitPrice) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const [result] = await pool.query(
      `INSERT INTO products
       (category_id, sku, product_name, description, unit_price, stock_quantity, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId,
        sku,
        productName,
        description || null,
        unitPrice,
        Number(stockQuantity || 0),
        uploadedImageUrl || imageUrl || null
      ]
    );

    return res.status(201).json({ message: 'Product created', productId: result.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
});

router.put('/:id', authRequired, requireRole('ADMIN'), upload.single('imageFile'), async (req, res) => {
  try {
    const { categoryId, sku, productName, description, unitPrice, stockQuantity, imageUrl, isActive } = req.body;
    const uploadedImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const finalImageUrl = uploadedImageUrl || imageUrl || undefined;

    const [result] = await pool.query(
      `UPDATE products
       SET category_id = COALESCE(?, category_id),
           sku = COALESCE(?, sku),
           product_name = COALESCE(?, product_name),
           description = COALESCE(?, description),
           unit_price = COALESCE(?, unit_price),
           stock_quantity = COALESCE(?, stock_quantity),
           image_url = COALESCE(?, image_url),
           is_active = COALESCE(?, is_active)
       WHERE product_id = ?`,
      [
        categoryId || null,
        sku || null,
        productName || null,
        description || null,
        unitPrice || null,
        typeof stockQuantity === 'number' ? stockQuantity : null,
        finalImageUrl,
        typeof isActive === 'boolean' ? (isActive ? 1 : 0) : null,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json({ message: 'Product updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
});

router.delete('/:id', authRequired, requireRole('ADMIN'), async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE products SET is_active = 0 WHERE product_id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json({ message: 'Product deactivated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to deactivate product', error: error.message });
  }
});

module.exports = router;
