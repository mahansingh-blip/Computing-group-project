const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT address_id, label, recipient_name, line1, line2, city, state, postal_code, country, is_default
       FROM addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, address_id DESC`,
      [req.user.userId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch addresses', error: error.message });
  }
});

router.post('/', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { label, recipientName, line1, line2, city, state, postalCode, country, isDefault } = req.body;

    if (!recipientName || !line1 || !city || !postalCode || !country) {
      return res.status(400).json({ message: 'Missing required address fields' });
    }

    await connection.beginTransaction();

    if (isDefault) {
      await connection.query(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
        [req.user.userId]
      );
    }

    const [result] = await connection.query(
      `INSERT INTO addresses (user_id, label, recipient_name, line1, line2, city, state, postal_code, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.userId,
        label || null,
        recipientName,
        line1,
        line2 || null,
        city,
        state || null,
        postalCode,
        country,
        isDefault ? 1 : 0
      ]
    );

    await connection.commit();

    return res.status(201).json({ message: 'Address created', addressId: result.insertId });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: 'Failed to create address', error: error.message });
  } finally {
    connection.release();
  }
});

router.put('/:id', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { label, recipientName, line1, line2, city, state, postalCode, country, isDefault } = req.body;

    await connection.beginTransaction();

    if (isDefault) {
      await connection.query(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
        [req.user.userId]
      );
    }

    const [result] = await connection.query(
      `UPDATE addresses
       SET label = COALESCE(?, label),
           recipient_name = COALESCE(?, recipient_name),
           line1 = COALESCE(?, line1),
           line2 = COALESCE(?, line2),
           city = COALESCE(?, city),
           state = COALESCE(?, state),
           postal_code = COALESCE(?, postal_code),
           country = COALESCE(?, country),
           is_default = COALESCE(?, is_default)
       WHERE address_id = ? AND user_id = ?`,
      [
        label || null,
        recipientName || null,
        line1 || null,
        line2 || null,
        city || null,
        state || null,
        postalCode || null,
        country || null,
        typeof isDefault === 'boolean' ? (isDefault ? 1 : 0) : null,
        req.params.id,
        req.user.userId
      ]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Address not found' });
    }

    await connection.commit();

    return res.json({ message: 'Address updated' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: 'Failed to update address', error: error.message });
  } finally {
    connection.release();
  }
});

router.patch('/:id/default', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [exists] = await connection.query(
      `SELECT address_id FROM addresses WHERE address_id = ? AND user_id = ?`,
      [req.params.id, req.user.userId]
    );

    if (exists.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Address not found' });
    }

    await connection.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.userId]);
    await connection.query(
      'UPDATE addresses SET is_default = 1 WHERE address_id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );

    await connection.commit();

    return res.json({ message: 'Default address set' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: 'Failed to set default address', error: error.message });
  } finally {
    connection.release();
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      `DELETE FROM addresses
       WHERE address_id = ? AND user_id = ?`,
      [req.params.id, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Address not found' });
    }

    return res.json({ message: 'Address deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete address', error: error.message });
  }
});

module.exports = router;
