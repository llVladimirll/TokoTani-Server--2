const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const register = async (req, res, pool) => {
    const { name, email, password } = req.body;
    try{
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
          'INSERT INTO users (name, email, password, isseller, created_at) VALUES ($1, $2, $3, $4, NOW())', [name, email, hashedPassword, false]

        );
        res.status(201).json({message: 'User Registered Successfully'});
      }catch(err){
        console.log(err);
        res.status(500).json({ message: 'Error registering user' });
      }
}

const login = async (req, res, pool) => {
  const {email, password} = req.body;
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1', [email]
    );
    if (userResult.rows.length === 0){
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if(!isPasswordValid){
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const userToken = jwt.sign({userID : user.id, isseller : user.isSeller }, process.env.JWT_SECRET, { expiresIn: '12h'});
    
    if(user.isSeller){
      const sellerResult = await pool.query('SELECT * FROM seller WHERE user_id = $1', [user.id]);
      const seller = sellerResult.rows[0];

      const sellerToken = jwt.sign({SellerID: seller.id }, process.env.JWT_SECRET, { expiresIn: '24h'});

      res.status(200).json({ userToken: userToken, sellerToken: sellerToken});
    }else{
      res.status(200).json({ userToken: userToken});
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error in logging user' });
  }
}

module.exports = {
    register,
    login
}