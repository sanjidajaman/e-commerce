const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');

dotenv.config();
connectDB();

const users = [
  { name: 'Admin User', email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { name: 'Demo Customer', email: 'user@example.com', password: 'user1234', role: 'user' },
];

const categories = [
  'Electronics',
  'Fashion',
  'Home & Kitchen',
  'Books',
  'Beauty',
  'Sports',
  'Toys',
  'Grocery',
];

const productNames = {
  Electronics: ['Wireless Headphones', 'Smart Watch', 'Bluetooth Speaker', 'Laptop Stand', '4K Webcam'],
  Fashion: ['Denim Jacket', 'Running Sneakers', 'Leather Wallet', 'Polarized Sunglasses', 'Cotton T-Shirt'],
  'Home & Kitchen': ['Air Fryer', 'Drip Coffee Maker', '12-Piece Cutlery Set', 'Fleece Throw Blanket', 'Ceramic Mug Set'],
  Books: ['The Silent Ocean', 'Atomic Focus', 'A History of Tomorrow', 'The Startup Trail', 'Mindful Coding'],
  Beauty: ['Vitamin C Serum', 'Hydrating Face Mask', 'Matte Lipstick Set', 'Argan Hair Oil', 'Body Lotion'],
  Sports: ['Yoga Mat', 'Adjustable Dumbbells', 'Running Belt', 'Resistance Bands Set', 'Insulated Water Bottle'],
  Toys: ['Building Blocks Set', 'RC Off-Road Car', 'Wooden Puzzle Cube', 'Plush Teddy Bear', 'Family Board Game'],
  Grocery: ['Organic Wildflower Honey', 'Cold Brew Coffee Beans', 'Trail Mix Pack', 'Extra Virgin Olive Oil', 'Herbal Tea Box'],
};

const buildProducts = () => {
  const products = [];
  let seed = 1;
  categories.forEach((category) => {
    productNames[category].forEach((name) => {
      products.push({
        name,
        description: `${name} - a high quality ${category.toLowerCase()} pick built to last. Great value, fast shipping, and backed by our satisfaction guarantee.`,
        price: Number((Math.random() * 180 + 15).toFixed(2)),
        image: `https://picsum.photos/seed/eshop${seed}/600/600`,
        images: [
          `https://picsum.photos/seed/eshop${seed}a/600/600`,
          `https://picsum.photos/seed/eshop${seed}b/600/600`,
        ],
        category,
        stock: Math.floor(Math.random() * 40) + 5,
        rating: Number((Math.random() * 2 + 3).toFixed(1)),
        numReviews: Math.floor(Math.random() * 30),
      });
      seed += 1;
    });
  });
  return products;
};

const importData = async () => {
  try {
    await Promise.all([
      Order.deleteMany(),
      Cart.deleteMany(),
      Product.deleteMany(),
      User.deleteMany(),
      Coupon.deleteMany(),
    ]);

    // Use create() (not insertMany) so the password-hashing pre-save hook runs.
    const createdUsers = await User.create(users);
    const adminId = createdUsers.find((u) => u.role === 'admin')._id;

    const products = buildProducts().map((p) => ({ ...p, user: adminId }));
    await Product.insertMany(products);

    await Coupon.create([
      {
        code: 'WELCOME10',
        discountType: 'percentage',
        discountValue: 10,
        minPurchase: 0,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      {
        code: 'SAVE20',
        discountType: 'fixed',
        discountValue: 20,
        minPurchase: 50,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    ]);

    console.log('Data imported successfully!\n');
    console.log('Admin login -> email: admin@example.com | password: admin123');
    console.log('User login  -> email: user@example.com  | password: user1234');
    console.log('Coupons     -> WELCOME10 (10% off), SAVE20 ($20 off orders $50+)');
    process.exit();
  } catch (error) {
    console.error(`Error importing data: ${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await Promise.all([
      Order.deleteMany(),
      Cart.deleteMany(),
      Product.deleteMany(),
      User.deleteMany(),
      Coupon.deleteMany(),
    ]);
    console.log('Data destroyed!');
    process.exit();
  } catch (error) {
    console.error(`Error destroying data: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
