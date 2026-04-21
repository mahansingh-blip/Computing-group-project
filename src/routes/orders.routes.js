const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { generateOrderNumber } = require('../utils/orderNumber');

const router = express.Router();

router.use(authRequired);

router.post('/checkout', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { addressId, paymentMethod = 'COD' } = req.body;

    await connection.beginTransaction();

    const [cartRows] = await connection.query('SELECT cart_id FROM carts WHERE user_id = ?', [req.user.userId]);
    if (cartRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Cart not found' });
    }

    const cartId = cartRows[0].cart_id;

    const [items] = await connection.query(
      `SELECT ci.cart_item_id, ci.product_id, ci.quantity, ci.unit_price_snapshot,
              p.stock_quantity, p.product_name
       FROM cart_items ci
       JOIN products p ON p.product_id = ci.product_id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    if (items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Cart is empty' });
    }

    for (const item of items) {
      if (item.stock_quantity < item.quantity) {
        await connection.rollback();
        return res.status(400).json({
          message: `Insufficient stock for product ${item.product_name}`
        });
      }
    }

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.unit_price_snapshot) * item.quantity,
      0
    );
    const shippingFee = subtotal > 100 ? 0 : 5;
    const taxAmount = Number((subtotal * 0.05).toFixed(2));
    const totalAmount = Number((subtotal + shippingFee + taxAmount).toFixed(2));

    const orderNumber = generateOrderNumber();

    const [orderResult] = await connection.query(
      `INSERT INTO orders
       (user_id, address_id, order_number, order_status, subtotal, shipping_fee, tax_amount, total_amount)
       VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
      [req.user.userId, addressId || null, orderNumber, subtotal, shippingFee, taxAmount, totalAmount]
    );

    const orderId = orderResult.insertId;

    for (const item of items) {
      const lineTotal = Number((Number(item.unit_price_snapshot) * item.quantity).toFixed(2));

      await connection.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.unit_price_snapshot, lineTotal]
      );

      await connection.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
        [item.quantity, item.product_id]
      );
    }

    await connection.query(
      `INSERT INTO payments (order_id, payment_method, payment_status, amount, paid_at)
       VALUES (?, ?, 'SUCCESS', ?, NOW())`,
      [orderId, paymentMethod, totalAmount]
    );

    await connection.query(
      `UPDATE orders SET order_status = 'PAID' WHERE order_id = ?`,
      [orderId]
    );

    await connection.query(
      `INSERT INTO notifications (user_id, order_id, title, message, notification_type)
       VALUES (?, ?, 'Order Confirmed', ?, 'ORDER_UPDATE')`,
      [req.user.userId, orderId, `Your order ${orderNumber} was placed successfully.`]
    );

    await connection.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

    await connection.commit();

    return res.status(201).json({
      message: 'Checkout completed',
      orderId,
      orderNumber,
      totalAmount
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: 'Checkout failed', error: error.message });
  } finally {
    connection.release();
  }
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT order_id, order_number, order_status, subtotal, shipping_fee, tax_amount, total_amount, placed_at
       FROM orders
       WHERE user_id = ?
       ORDER BY placed_at DESC`,
      [req.user.userId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [orderRows] = await pool.query(
      `SELECT order_id, order_number, order_status, subtotal, shipping_fee, tax_amount, total_amount, placed_at
       FROM orders
       WHERE order_id = ? AND user_id = ?`,
      [req.params.id, req.user.userId]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const [itemRows] = await pool.query(
      `SELECT oi.order_item_id, oi.product_id, p.product_name, oi.quantity, oi.unit_price, oi.line_total
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?`,
      [req.params.id]
    );

    return res.json({ ...orderRows[0], items: itemRows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch order details', error: error.message });
  }
});

router.patch('/:id/cancel', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      `SELECT order_id, order_status, order_number
       FROM orders
       WHERE order_id = ? AND user_id = ?`,
      [req.params.id, req.user.userId]
    );

    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderRows[0];
    if (order.order_status === 'CANCELLED' || order.order_status === 'DELIVERED') {
      await connection.rollback();
      return res.status(400).json({ message: 'Order cannot be cancelled in current state' });
    }

    await connection.query(
      `UPDATE orders SET order_status = 'CANCELLED' WHERE order_id = ?`,
      [order.order_id]
    );

    const [items] = await connection.query(
      `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
      [order.order_id]
    );

    for (const item of items) {
      await connection.query(
        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?',
        [item.quantity, item.product_id]
      );
    }

    await connection.query(
      `INSERT INTO notifications (user_id, order_id, title, message, notification_type)
       VALUES (?, ?, 'Order Cancelled', ?, 'ORDER_UPDATE')`,
      [req.user.userId, order.order_id, `Your order ${order.order_number} has been cancelled.`]
    );

    await connection.commit();

    return res.json({ message: 'Order cancelled' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: 'Failed to cancel order', error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
