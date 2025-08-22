const express = require('express');

const router = express.Router();
const Product = require('../models/Product');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// --- Reviews ---
// Get reviews for a product
router.get('/:id/reviews', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product.reviews || []);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// Post a review (requires auth)
router.post('/:id/reviews', authMiddleware, async (req, res) => {
  const { comment, rating } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Invalid rating' });
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const review = {
      user: req.user.id,
      username: req.user.username,
      comment: comment || '',
      rating: Number(rating),
      createdAt: new Date()
    };
    product.reviews.push(review);
    await product.save();
    res.status(201).json({ message: 'Review added', review });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add review' });
  }
});

// --- Recommended Products ---
router.get('/:id/recommend', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const recs = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      approved: true,
      rejected: false
    }).limit(5);
    res.json(recs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recommendations' });
  }
});

//routes/productRoutes.js
console.log('🔌 productRoutes module loaded');

// Set up multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'));
  }
});

// Admin-only middleware
const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Admins only' });
};

// PATCH: Update product stock/quantity (admin only)
router.patch('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { stock } = req.body;
    if (typeof stock !== 'number' && typeof stock !== 'string') {
      return res.status(400).json({ message: 'Invalid stock value' });
    }
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock: Number(stock) },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Stock updated', product });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update stock' });
  }
});

router.get('/pending-debug', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pending = await Product.find({ approved: false, rejected: false });
    res.json(pending);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching pending products (debug)' });
  }
});


// 🔍 Get all pending products (unapproved)
router.get('/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('🔐 Authenticated user:', req.user);
    const pending = await Product.find({ approved: false, rejected: false }).populate('seller', 'username');
    console.log('✅ Fetched pending products:', pending);
    res.json(pending);
  } catch (err) {
    console.error('❌ Error in /pending:', err.stack || err);
    res.status(500).json({ message: 'Error fetching pending products' });
  }
});


// ✅ Approve product by ID

router.patch('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { status, reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const update = {
      approved: status === 'approved',
      rejected: status === 'rejected',
    };
    if (status === 'rejected') {
      update.rejectionReason = reason || '';
    } else {
      update.rejectionReason = '';
    }
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: `Product ${status}` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update product status' });
  }
});

// Get all products
router.get('/', async (req, res) => {
  console.log("📥 GET /api/products hit");

  const { approvedOnly } = req.query;
  let query = {};
  if (approvedOnly === 'true') {
    query = { approved: true, rejected: false };
  }

  try {
    let products;
    let isAdmin = false;
    if (req.headers && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'secret';
        const decoded = jwt.verify(token, secret);
        if (decoded && decoded.role === 'admin') isAdmin = true;
      } catch (e) {}
    }
        if (isAdmin) {
            products = await Product.find(query).populate('seller', 'username');
        } else {
            products = await Product.find(query);
        }
        // Add status and reason fields for admin dashboard compatibility
        const mapped = products.map(p => {
            let status = 'pending';
            if (p.approved) status = 'approved';
            else if (p.rejected) status = 'rejected';
            return {
                ...p.toObject(),
                status,
                reason: p.rejectionReason || ''
            };
        });
        console.log(`📦 Found ${products.length} products`);
        res.json(mapped);
  } catch (err) {
    console.error('❌ Error fetching products:', err);
    res.status(500).json({ message: err.message });
  }
});


// Get product by ID
router.get('/:id', async (req, res) => {
  console.log(`🔍 GET /api/products/${req.params.id} hit`);
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.log('⚠️ Product not found');
      return res.status(404).json({ message: "Product not found" });
    }
    console.log('✅ Product found:', product.name);
    res.json(product);
  } catch (err) {
    console.error('❌ Error fetching product by ID:', err);
    res.status(500).json({ message: err.message });
  }
});


// Create a new product with image upload
router.post('/', authMiddleware, upload.single('imageFile'), async (req, res) => {
  console.log('📝 POST /api/products hit');
  console.log('🛒 Request Body:', req.body);
  if (req.file) {
    console.log('📸 Uploaded file:', req.file.filename);
  }
  const product = new Product({
    name: req.body.name,
    category: req.body.category,
    price: req.body.price,
    image: req.file ? '/uploads/' + req.file.filename : '', // store file path
    description: req.body.description,
    stock: req.body.stock,
    approved: false, // explicitly mark as pending
    seller: req.user.id, // link to logged-in seller
  });

  try {
    const newProduct = await product.save();
    res.status(201).json({ message: '✅ Awaiting admin approval', product: newProduct });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a product by ID (seller only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    // Only allow the seller who owns the product to delete
    if (product.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }
    // Allow delete for any product owned by the seller (approved, rejected, or pending)
    await product.deleteOne();
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

module.exports = router;
