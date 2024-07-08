const express = require('express');
const userController = require('../controller/userController');
const router = express.Router();



router.post('/register', (req, res) => userController.register(req, res, req.pool));
router.post('/login', (req, res) => userController.login(req, res, req.pool));
router.post('/address/:id', (req, res) => userController.postAddress(req, res, req.pool));
router.get('/:id', (req, res) => userController.getUser(req, res, req.pool));
router.get('/orders/:id', (req,res) => userController.getOrder(req, res, req.pool));
router.get('/address/:userId', (req, res) => userController.getAdresses(req, res, req.pool));
router.get('/cart/:userId', (req, res) => userController.getCartItems(req, res, req.pool));
router.patch('/order/:orderId', (req, res) => userController.patchOrder(req, res, req.pool));
router.put('/:id', (req, res) => userController.putUser(req, res, req.pool));

module.exports = router;