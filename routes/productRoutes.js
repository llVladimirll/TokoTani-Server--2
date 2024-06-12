const express = require('express');
const router = express.Router();
const productController = require('../controller/productController')


router.post('/', productController.upload.single('productImage'), (req, res,) => productController.postProduct(req, res, req.pool));
router.get('/', async (req, res) => productController.getAllProductData(req, res, req.pool));
// router.get('/{id}', (req, res))

module.exports = router;