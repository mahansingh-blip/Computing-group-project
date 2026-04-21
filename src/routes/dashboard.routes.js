const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [[orderStats]] = await pool.query(
      `SELECT
         COUNT(*) AS total_orders,
         COALESCE(SUM(total_amount), 0) AS total_spent,
         COALESCE(SUM(CASE WHEN order_status IN ('PENDING','PAID','PROCESSING','SHIPPED') THEN 1 ELSE 0 END), 0) AS active_orders
       FROM orders
       WHERE user_id = ?`,
      [userId]
    );

    const [[cartStats]] = await pool.query(
      `SELECT
         COALESCE(COUNT(ci.cart_item_id), 0) AS cart_items,
         COALESCE(SUM(ci.quantity * ci.unit_price_snapshot), 0) AS cart_total
       FROM carts c
       LEFT JOIN cart_items ci ON ci.cart_id = c.cart_id
       WHERE c.user_id = ?`,
      [userId]
    );

    const [recentOrders] = await pool.query(
      `SELECT order_id, order_number, order_status, total_amount, placed_at
       FROM orders
       WHERE user_id = ?
       ORDER BY placed_at DESC
       LIMIT 5`,
      [userId]
    );

    return res.json({
      orderStats,
      cartStats,
      recentOrders
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch dashboard summary', error: error.message });
  }
});

module.exports = router;
