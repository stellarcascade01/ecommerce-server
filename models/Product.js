// server/models/Product.js 
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  image: String,
  description: String,
  stock: Number,
  approved: {
    type: Boolean,
    default: false,
  },
  rejected: { type: Boolean, default: false },
  rejectionReason: { type: String, default: '' },

  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  reviews: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      username: String,
      comment: String,
      rating: { type: Number, min: 1, max: 5 },
      createdAt: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model('Product', productSchema);
