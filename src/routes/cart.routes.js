const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const [cartRows] = await pool.query('SELECT cart_id FROM carts WHERE user_id = ?', [req.user.userId]);
    if (cartRows.length === 0) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const cartId = cartRows[0].cart_id;

    const [items] = await pool.query(
      `SELECT ci.cart_item_id, ci.product_id, p.product_name, ci.quantity, ci.unit_price_snapshot,
              (ci.quantity * ci.unit_price_snapshot) AS line_total
       FROM cart_items ci
       JOIN products p ON p.product_id = ci.product_id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    const total = items.reduce((sum, item) => sum + Number(item.line_total), 0);
    return res.json({ cartId, items, total: Number(total.toFixed(2)) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch cart', error: error.message });
  }
});

router.post('/items', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid productId or quantity' });
    }

    const [cartRows] = await pool.query('SELECT cart_id FROM carts WHERE user_id = ?', [req.user.userId]);
    const cartId = cartRows[0].cart_id;

    const [productRows] = await pool.query(
      'SELECT product_id, unit_price, stock_quantity, is_active FROM products WHERE product_id = ?',
      [productId]
    );

    if (productRows.length === 0 || productRows[0].is_active !== 1) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (productRows[0].stock_quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity, unit_price_snapshot)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       quantity = quantity + VALUES(quantity),
       unit_price_snapshot = VALUES(unit_price_snapshot)`,
      [cartId, productId, quantity, productRows[0].unit_price]
    );

    return res.status(201).json({ message: 'Item added to cart' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add item', error: error.message });
  }
});

router.put('/items/:cartItemId', async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than zero' });
    }

    const [result] = await pool.query(
      `UPDATE cart_items ci
       JOIN carts c ON c.cart_id = ci.cart_id
       SET ci.quantity = ?
       WHERE ci.cart_item_id = ? AND c.user_id = ?`,
      [quantity, req.params.cartItemId, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    return res.json({ message: 'Cart item updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update cart item', error: error.message });
  }
});

router.delete('/items/:cartItemId', async (req, res) => {
  try {
    const [result] = await pool.query(
      `DELETE ci FROM cart_items ci
       JOIN carts c ON c.cart_id = ci.cart_id
       WHERE ci.cart_item_id = ? AND c.user_id = ?`,
      [req.params.cartItemId, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    return res.json({ message: 'Cart item removed' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove cart item', error: error.message });
  }
});

module.exports = router;
