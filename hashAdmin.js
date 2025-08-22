const bcrypt = require('bcrypt');

const plainPassword = '123';

bcrypt.hash(plainPassword, 10).then((hash) => {
  console.log('🔒 Hashed Password:', hash);
}).catch((err) => {
  console.error('Error hashing password:', err);
});
