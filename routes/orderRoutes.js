// server/routes/orderRoutes.js
console.log('🔌 orderRoutes module loaded');

const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const authMiddleware = require('../middleware/authMiddleware');

// (GET /api/orders route removed: no public or user-facing past orders API)

// GET a specific order by ID
router.get('/:id', async (req, res) => {
  console.log(`📥 GET /api/orders/${req.params.id} hit`);

  try {
    const order = await Order.findById(req.params.id).populate('products.productId');
    if (!order) {
      console.warn("⚠️ Order not found");
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    console.error("❌ Error fetching order by ID:", err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// POST /api/orders — create new order
router.post('/', authMiddleware, async (req, res) => {
  console.log("📨 POST /api/orders hit");
  console.log("📝 Request body:", req.body);

  try {
    const { products, customerName, email, phone, address } = req.body;

    if (
      !products || !Array.isArray(products) || products.length === 0 ||
      !customerName || !email || !phone || !address
    ) {
      return res.status(400).json({ error: 'Missing or invalid required fields' });
    }

    // Optional: simple email format check
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Optional: simple phone validation (digits and optional +, -, spaces)
    const phoneRegex = /^[\d+\-\s]{7,15}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Attach userId from auth middleware
    const userId = req.user && req.user.id ? req.user.id : undefined;
    const newOrder = new Order({ userId, products, customerName, email, phone, address });
    const savedOrder = await newOrder.save();

    console.log("✅ Order saved:", savedOrder._id);
    res.status(201).json({ message: '✅ Order saved successfully', order: savedOrder });
  } catch (error) {
    console.error('❌ Order save error:', error);
    res.status(500).json({ error: 'Order could not be saved' });
  }
});


module.exports = router;
