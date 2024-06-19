const express = require('express');
const router = express.Router();
const sellerController = require('../controller/sellerController')

router.post('/', sellerController.upload.single('sellerImage'), (req, res) => sellerController.postSeller(req, res, req.pool));

module.exports = router;