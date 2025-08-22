// File: server/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'seller', 'buyer'],
    default: 'buyer',
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active',
  },
  // Optional shop name for sellers
  shopName: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model('User', userSchema);
