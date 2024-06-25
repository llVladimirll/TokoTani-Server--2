const express = require('express');
const router = express.Router();
const productController = require('../controller/productController')


router.post('/', productController.upload.single('productImage'), (req, res) => productController.postProduct(req, res, req.pool));
router.get('/', async (req, res) => productController.getAllProductData(req, res, req.pool));
router.get('/:id', (req, res) => productController.getSingleProduct(req, res, req.pool));
router.post('/feedback', (req, res) => productController.postFeedback(req, res, req.pool));
router.post('/cart', (req, res) => productController.postCart(req, res, req.pool));


module.exports = router;