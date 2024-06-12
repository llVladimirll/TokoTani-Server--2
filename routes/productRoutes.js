const express = require('express');
const router = express.Router();
const productController = require('../controller/productController')


router.post('/', productController.upload.single('productImage'), (req, res,) => productController.postProduct(req, res, req.pool));
router.get('/images', (req, res) => productController.getAllProductImage(req, res, req.pool));
router.get('/data', (req, res) => productController.getAllProductData(req, res, req.pool));

module.exports = router;