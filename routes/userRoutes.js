
const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to authenticate user by JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

// GET current user's profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    console.log('GET /me called. req.user:', req.user);
    const user = await User.findById(req.user.id, '-password');
    if (!user) {
      console.log('User not found for id:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Failed to fetch profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

// PATCH current user's profile
router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const updates = {};
    if (req.body.username) updates.username = req.body.username;
    if (req.body.email) updates.email = req.body.email;
    if (req.body.shopName) updates.shopName = req.body.shopName;
    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Profile updated', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

//routes/userRoutes
console.log('🔌 userRoutes module loaded');

// Unblock a user (admin only)
router.patch('/:id/unblock', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'active' } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User unblocked', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Block a user (admin only)
router.patch('/:id/block', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'blocked' } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User blocked', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Delete a user (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Register
router.post('/register', async (req, res) => {
  const { username, email, password ,role} = req.body;
  if (!email || !password || !username)
    return res.status(400).json({ error: 'All fields required' });

  const existingUser = await User.findOne({ email });
  if (existingUser)
    return res.status(409).json({ error: 'Email already in use' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, email, password: hashedPassword,role });

  await newUser.save();
  res.status(201).json({ message: '✅ Registered successfully' });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'Your account is blocked. Please contact support.' });
  }
  // Generate JWT token
  const token = jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.status(200).json({
    message: '✅ Login successful',
    user: { id: user._id, username: user.username, role: user.role },
    token,
  });

});

// GET all users (optional, for admin use)
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // exclude passwords
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET a user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
