const express = require('express');
const router = express.Router();
const sellerController = require('../controller/sellerController');

// GET endpoint to fetch product details for editing
router.get('/product/:productId', (req, res) => {
  sellerController.getProductForEdit(req, res, req.pool);
});

// POST endpoint to handle seller profile creation/updating
router.post('/:userId', sellerController.upload.single('sellerImage'), (req, res) => {
  sellerController.postSeller(req, res, req.pool);
});

// GET endpoint to fetch products by seller ID
router.get('/products/:sellerId', (req, res) => {
  sellerController.getProduct(req, res, req.pool);
});

// PATCH endpoint to update order status (ship products)
router.patch('/ship/:orderId', (req, res) => {
  sellerController.shipProducts(req, res, req.pool);
});

// GET endpoint to fetch orders by seller ID
router.get('/orders/:sellerId', (req, res) => {
  sellerController.getOrder(req, res, req.pool);
});

// GET endpoint to fetch recommendations for a seller
router.get('/recomendations/:sellerId', (req, res) => {
  sellerController.getRecomendations(req, res, req.pool);
});

// GET endpoint to fetch earnings for a seller
router.get('/earnings/:sellerId', (req, res) => {
  sellerController.getEarnings(req, res, req.pool);
});

// GET endpoint to fetch total earnings for a seller
router.get('/total/:sellerId', (req, res) => {
  sellerController.getTotalEarnings(req, res, req.pool);
});

// PUT endpoint to update product details
router.put('/product/:productId', (req, res) => {
  sellerController.putProduct(req, res, req.pool);
});

router.delete('/product/:productId', (req, res) => {
    sellerController.deleteProduct(req, res, req.pool);
});

module.exports = router;
