const express = require('express');
const userController = require('../controller/userController');
const router = express.Router();

router.post('/register', (req, res) => userController.register(req, res, req.pool));
router.post('/login', (req, res) => userController.login(req, res, req.pool));

module.exports = router;