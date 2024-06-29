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
  const { email, password } = req.body;
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1', [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const userToken = jwt.sign({ userID: user.id, isSeller: user.isseller }, process.env.JWT_SECRET, { expiresIn: '12h' });

    if (user.isseller) { // Assuming 'isseller' is the correct field name
      const sellerResult = await pool.query('SELECT * FROM seller WHERE user_id = $1', [user.id]);
      if (sellerResult.rows.length === 0) {
        return res.status(401).json({ message: 'User is marked as seller but no corresponding seller found' });
      }
      const seller = sellerResult.rows[0];
      const sellerToken = jwt.sign({ SellerID: seller.id }, process.env.JWT_SECRET, { expiresIn: '24h' });

      return res.status(200).json({ userToken, sellerToken });
    } else {
      return res.status(200).json({ userToken });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error in logging user' });
  }
}


const postAddress = async (req, res, pool) => {
  const { address_line1, address_line2, city, province, postal_code, country } = req.body;
  const user_id = req.params.id;

  try {
      await pool.query(
          'INSERT INTO addresses (user_id, address_line1, address_line2, city, province, postal_code, country, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
          [user_id, address_line1, address_line2, city, province, postal_code, country]
      );
      res.status(201).json({ message: 'Address added successfully' });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error adding address' });
  }
};

module.exports = {
    register,
    login,
    postAddress
}