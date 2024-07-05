const express = require('express');
const router = express.Router();
const productController = require('../controller/productController')

router.post('/cart', (req, res) => productController.postCart(req, res, req.pool));
router.post('/feedback', (req, res) => productController.postFeedback(req, res, req.pool));
router.post('/:sellerId', productController.upload.single('productImage'), (req, res) => productController.postProduct(req, res, req.pool));
router.get('/', (req, res) => productController.getAllProductData(req, res, req.pool));
router.get('/:id', (req, res) => productController.getSingleProduct(req, res, req.pool));
router.get('/cart/:id', (req, res) => productController.getShoppingCart(req, res, req.pool));
router.put('/cart/:userId/:itemId', (req, res) => productController.putCart(req, res, req.pool));
router.post('/checkout/:userId', (req, res) => productController.postCheckout(req, res, req.pool));
router.get('/order/:sellerID', (req, res) => productController.getOrder(req, res, req.pool));
router.delete('/cart/:sellerId/:itemId', (req, res) => productController.deleteCartItem(req, res, req.pool));

module.exports = router;