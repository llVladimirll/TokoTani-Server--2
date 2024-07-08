const express = require('express');
const router = express.Router();
const sellerController = require('../controller/sellerController')

router.post('/:userId', sellerController.upload.single('sellerImage'), (req, res) => sellerController.postSeller(req, res, req.pool));
router.get('/products/:sellerId',(req, res) => sellerController.getProduct(req, res, req.pool));
router.patch('/ship/:orderId', (req, res) => sellerController.shipProducts (req, res, req.pool));
router.get('/orders/:sellerId', (req, res) => sellerController.getOrder(req, res, req.pool));
router.get('/recomendations/:sellerId', (req, res) => sellerController.getRecomendations(req, res, req.pool));
router.get('/earnings/:sellerId', (req, res) => sellerController.getEarnings(req, res, req.pool));
router.get('/total/:sellerId', (req, res) => sellerController.getTotalEarnings(req, res, req.pool));

module.exports = router;